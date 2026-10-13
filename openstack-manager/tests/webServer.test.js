import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import axios from "axios";
import { osClient } from "../src/services/openstackClient.js";
import { createInstance } from "../src/services/instanceService.js";
import { buildWebUserData, encodeUserData } from "../src/services/webUserData.js";
import { allowsPublicHttp, attachFloatingIp, ensureHttpRule, getInstancePorts } from "../src/services/webServerService.js";

const originals = { get: axios.get, post: axios.post, put: axios.put, token: osClient.token };
const target = { serverId: "server-demo", portId: "port-demo", fixedIp: "192.0.2.10", externalNetworkId: "network-public" };
const port = { id: target.portId, device_id: target.serverId, device_owner: "compute:nova", fixed_ips: [{ ip_address: target.fixedIp }] };
const publicHttp = { direction: "ingress", ethertype: "IPv4", protocol: "tcp", port_range_min: 80, port_range_max: 80, remote_ip_prefix: "0.0.0.0/0" };

beforeEach(() => {
    osClient.token = "mock-token";
    axios.get = axios.post = axios.put = async () => assert.fail("Unexpected request: tests must never reach the cloud");
});
afterEach(() => {
    axios.get = originals.get;
    axios.post = originals.post;
    axios.put = originals.put;
    osClient.token = originals.token;
});

function mockReads({ status = "ACTIVE", ports = [port], ips = [], external = true } = {}) {
    axios.get = async (url, config) => {
        assert.equal(config.headers["X-Auth-Token"], "mock-token");
        if (url.endsWith(`/servers/${target.serverId}`)) return { data: { server: { status } } };
        if (url.endsWith("/ports")) {
            assert.equal(config.params.device_id, target.serverId);
            return { data: { ports } };
        }
        if (url.endsWith("/floatingips")) return { data: { floatingips: ips } };
        if (url.endsWith(`/networks/${target.externalNetworkId}`)) return { data: { network: { "router:external": external } } };
        assert.fail(`Unexpected read: ${url}`);
    };
}

test("User Data preserves Vietnamese, escapes injected HTML/SSI, and configures dynamic IP output", () => {
    const info = 'Nhóm 10\nNguyễn Nhật Thanh <script>alert(1)</script><!--# include virtual="/secret" -->';
    const script = buildWebUserData(info);
    assert.equal(Buffer.from(encodeUserData(script), "base64").toString("utf8"), script);
    const config = JSON.parse(script.slice("#cloud-config\n".length));
    assert.deepEqual(config.packages, ["nginx"]);
    assert.equal(config.package_update, true);
    const html = config.write_files.find((file) => file.path.endsWith("index.html")).content;
    assert.match(html, /Nguyễn Nhật Thanh/);
    assert.ok(!html.includes("<script>"));
    assert.ok(!html.includes('<!--# include virtual="/secret" -->'));
    for (const variable of ["server_addr", "host"]) assert.ok(html.includes(`var="${variable}"`));
    assert.ok(!html.includes('var="remote_addr"'));
    assert.match(config.write_files[1].content, /ssi on;/);
    assert.match(config.runcmd[0][2], /nginx -t\nsystemctl enable nginx\nsystemctl restart nginx/);
});

test("User Data rejects missing group information and excessive payload size", () => {
    assert.throws(() => buildWebUserData(" "));
    assert.throws(() => buildWebUserData("a".repeat(8001)));
    assert.throws(() => encodeUserData("a".repeat(50000)));
});

test("Nova creation includes Base64 User Data and chosen Security Group while retaining volume boot", async () => {
    const script = buildWebUserData("Nhóm 10");
    axios.post = async (url, body, config) => {
        assert.equal(url, `${osClient.computeUrl}/servers`);
        assert.equal(config.headers["X-Auth-Token"], "mock-token");
        assert.equal(Buffer.from(body.server.user_data, "base64").toString("utf8"), script);
        assert.deepEqual(body.server.security_groups, [{ name: "group-demo" }]);
        assert.equal(body.server.block_device_mapping_v2[0].destination_type, "volume");
        return { data: { server: { id: "new-server" } } };
    };
    assert.deepEqual(await createInstance({ name: "web-demo", imageId: "image-demo", flavorId: "flavor-demo", networkId: "network-demo", volumeSize: 10, securityGroupId: "group-demo", userData: script }), { id: "new-server" });
});

test("recognizes broad HTTP rules but rejects restricted sources, protocols and ports", () => {
    const allows = (rule) => allowsPublicHttp({ security_group_rules: [rule] });
    assert.ok(allows(publicHttp));
    assert.ok(allows({ ...publicHttp, protocol: "6", port_range_min: 1, port_range_max: 100 }));
    assert.ok(allows({ ...publicHttp, protocol: null, port_range_min: null, port_range_max: null }));
    for (const changes of [{ direction: "egress" }, { ethertype: "IPv6" }, { protocol: "udp" }, { remote_ip_prefix: "192.0.2.0/24" }, { remote_ip_prefix: null, remote_group_id: "other-group" }, { port_range_min: 443, port_range_max: 443 }]) {
        assert.equal(allows({ ...publicHttp, ...changes }), false);
    }
});

test("existing HTTP permission causes no duplicate rule request", async () => {
    axios.get = async () => ({ data: { security_group: { security_group_rules: [publicHttp] } } });
    assert.deepEqual(await ensureHttpRule("group-demo"), { created: false });
});

test("adds only TCP IPv4 port 80 ingress to the selected group", async () => {
    axios.get = async () => ({ data: { security_group: { security_group_rules: [] } } });
    axios.post = async (url, body, config) => {
        assert.equal(url, `${osClient.networkUrl}/security-group-rules`);
        assert.equal(config.headers["X-Auth-Token"], "mock-token");
        assert.deepEqual(body, { security_group_rule: { security_group_id: "group-demo", ...publicHttp } });
        return { data: {} };
    };
    assert.deepEqual(await ensureHttpRule("group-demo"), { created: true });
});

test("port selection excludes router ports and ports belonging to other VMs", async () => {
    mockReads({ ports: [port, { ...port, id: "router", device_owner: "network:router_interface" }, { ...port, id: "foreign", device_id: "other-server" }] });
    assert.deepEqual(await getInstancePorts(target.serverId), [port]);
});

test("allocates and attaches a Floating IP with explicit fixed IP in a single write", async () => {
    mockReads();
    const result = { id: "ip-new", floating_ip_address: "198.51.100.10" };
    axios.post = async (url, body, config) => {
        assert.equal(url, `${osClient.networkUrl}/floatingips`);
        assert.equal(config.headers["X-Auth-Token"], "mock-token");
        assert.deepEqual(body, { floatingip: { floating_network_id: target.externalNetworkId, port_id: target.portId, fixed_ip_address: target.fixedIp } });
        return { data: { floatingip: result } };
    };
    assert.deepEqual(await attachFloatingIp(target), result);
});

test("reuses a free Floating IP via PUT without allocating another", async () => {
    mockReads({ ips: [{ id: "ip-free", port_id: null, floating_network_id: target.externalNetworkId }] });
    axios.put = async (url, body) => {
        assert.equal(url, `${osClient.networkUrl}/floatingips/ip-free`);
        assert.deepEqual(body, { floatingip: { port_id: target.portId, fixed_ip_address: target.fixedIp } });
        return { data: { floatingip: { id: "ip-free" } } };
    };
    assert.deepEqual(await attachFloatingIp({ ...target, floatingIpId: "ip-free" }), { id: "ip-free" });
});

test("refuses stale VM/port/network choices and already associated IPs before any write", async () => {
    for (const state of [
        { status: "BUILD" }, { ports: [] }, { external: false },
        { ips: [{ id: "ip-existing", port_id: target.portId, fixed_ip_address: target.fixedIp }] }
    ]) {
        mockReads(state);
        await assert.rejects(attachFloatingIp(target));
    }
    for (const existing of [
        { id: "ip-busy", port_id: "other-port", floating_network_id: target.externalNetworkId },
        { id: "ip-busy", port_id: null, floating_network_id: "other-network" }
    ]) {
        mockReads({ ips: [existing] });
        await assert.rejects(attachFloatingIp({ ...target, floatingIpId: existing.id }));
    }
});

test("never automatically retries a failed Floating IP allocation", async () => {
    mockReads();
    let writes = 0;
    const error = Object.assign(new Error("quota"), { response: { status: 409 } });
    axios.post = async () => { writes += 1; throw error; };
    await assert.rejects(attachFloatingIp(target), (caught) => caught === error);
    assert.equal(writes, 1);
});
