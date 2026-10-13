import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import axios from "axios";
import { osClient } from "../src/services/openstackClient.js";
import { createInstance, getInstances } from "../src/services/instanceService.js";

const originalGet = axios.get;
const originalPost = axios.post;
const originalToken = osClient.token;
const validForm = { name: " demo-vm ", imageId: "image-demo", flavorId: "flavor-demo", networkId: "network-demo", volumeSize: "10" };

afterEach(() => {
    axios.get = originalGet;
    axios.post = originalPost;
    osClient.token = originalToken;
});

test("uses shared authentication and reads the volume-backed server response", async () => {
    osClient.token = "mock-token";
    const servers = [{ id: "server-demo", status: "ACTIVE", image: "", addresses: { demo: [{ addr: "192.0.2.10" }] } }];
    axios.get = async (url, config) => {
        assert.equal(url, `${osClient.computeUrl}/servers/detail`);
        assert.equal(config.headers["X-Auth-Token"], "mock-token");
        return { data: { servers } };
    };
    assert.deepEqual(await getInstances(), servers);
});

test("creates a boot volume with selected resources and excludes adminPass", async () => {
    osClient.token = "mock-token";
    axios.post = async (url, body, config) => {
        assert.equal(url, `${osClient.computeUrl}/servers`);
        assert.equal(config.headers["X-Auth-Token"], "mock-token");
        assert.deepEqual(body, { server: {
            name: "demo-vm", flavorRef: "flavor-demo", networks: [{ uuid: "network-demo" }],
            block_device_mapping_v2: [{ boot_index: 0, uuid: "image-demo", source_type: "image", destination_type: "volume", volume_size: 10, delete_on_termination: true }]
        } });
        return { data: { server: { id: "server-demo", adminPass: "mock-only" } } };
    };
    assert.deepEqual(await createInstance(validForm), { id: "server-demo" });
});

test("rejects invalid input before any creation request", async () => {
    axios.post = async () => assert.fail("Invalid input must not reach Nova");
    for (const override of [{ name: " " }, { imageId: "" }, { flavorId: "" }, { networkId: "" }, { volumeSize: "0" }, { volumeSize: "1.5" }, { volumeSize: "abc" }]) {
        await assert.rejects(createInstance({ ...validForm, ...override }));
    }
});

test("requires authentication before listing or creating", async () => {
    osClient.token = null;
    axios.get = axios.post = async () => assert.fail("Unauthenticated requests must not be sent");
    await assert.rejects(getInstances(), /chua dang nhap/);
    await assert.rejects(createInstance(validForm), /chua dang nhap/);
});

test("preserves HTTP errors for UI handling and never retries creation", async () => {
    osClient.token = "mock-token";
    const error = Object.assign(new Error("quota"), { response: { status: 403 } });
    let calls = 0;
    axios.post = async () => { calls += 1; throw error; };
    await assert.rejects(createInstance(validForm), (caught) => caught === error);
    assert.equal(calls, 1);
});
