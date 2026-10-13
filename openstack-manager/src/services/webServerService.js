import axios from "axios";
import { osClient } from "./openstackClient.js";

export async function getFloatingIps() {
    const response = await axios.get(`${osClient.networkUrl}/floatingips`, osClient.getAuthHeaders());
    return response.data.floatingips || [];
}

export async function getInstancePorts(serverId) {
    if (!serverId) throw new Error("Vui lòng chọn VM.");
    const response = await axios.get(`${osClient.networkUrl}/ports`, {
        ...osClient.getAuthHeaders(), params: { device_id: serverId }
    });
    return (response.data.ports || []).filter((port) =>
        port.device_id === serverId && port.device_owner?.startsWith("compute:")
    );
}

export function allowsPublicHttp(group) {
    return (group?.security_group_rules || []).some((rule) =>
        rule.direction === "ingress" && rule.ethertype === "IPv4" &&
        !rule.remote_group_id && !rule.remote_address_group_id &&
        (!rule.remote_ip_prefix || rule.remote_ip_prefix === "0.0.0.0/0") &&
        (rule.protocol == null || rule.protocol === "tcp" || String(rule.protocol) === "6") &&
        (rule.protocol == null || (rule.port_range_min == null && rule.port_range_max == null) ||
            (rule.port_range_min != null && rule.port_range_max != null && rule.port_range_min <= 80 && rule.port_range_max >= 80))
    );
}

export async function ensureHttpRule(groupId) {
    if (!groupId) throw new Error("Vui lòng chọn Security Group.");
    const response = await axios.get(`${osClient.networkUrl}/security-groups/${encodeURIComponent(groupId)}`, osClient.getAuthHeaders());
    if (allowsPublicHttp(response.data.security_group)) return { created: false };
    await axios.post(`${osClient.networkUrl}/security-group-rules`, {
        security_group_rule: {
            security_group_id: groupId, direction: "ingress", ethertype: "IPv4",
            protocol: "tcp", port_range_min: 80, port_range_max: 80, remote_ip_prefix: "0.0.0.0/0"
        }
    }, osClient.getAuthHeaders());
    return { created: true };
}

export async function attachFloatingIp({ serverId, portId, fixedIp, externalNetworkId, floatingIpId }) {
    if (!serverId || !portId || !fixedIp || !externalNetworkId) throw new Error("Chọn VM, port/IP nội bộ và External Network.");
    // Đọc lại trước khi ghi để không gắn nhầm port hoặc lấy IP đang thuộc VM khác.
    const [serverResponse, ports, floatingIps, networkResponse] = await Promise.all([
        axios.get(`${osClient.computeUrl}/servers/${encodeURIComponent(serverId)}`, osClient.getAuthHeaders()),
        getInstancePorts(serverId), getFloatingIps(),
        axios.get(`${osClient.networkUrl}/networks/${encodeURIComponent(externalNetworkId)}`, osClient.getAuthHeaders())
    ]);
    if (serverResponse.data.server.status !== "ACTIVE") throw new Error("VM phải ở trạng thái ACTIVE trước khi gắn Floating IP.");
    const port = ports.find((item) => item.id === portId);
    if (!port?.fixed_ips?.some((ip) => ip.ip_address === fixedIp && !ip.ip_address.includes(":"))) {
        throw new Error("Port hoặc IPv4 nội bộ không còn thuộc VM đã chọn. Hãy tải lại.");
    }
    if (networkResponse.data.network["router:external"] !== true) throw new Error("Network đã chọn không phải External Network.");
    if (floatingIps.some((ip) => ip.port_id === portId && ip.fixed_ip_address === fixedIp)) {
        throw new Error("IP nội bộ này đã có Floating IP. Hãy làm mới danh sách để xem.");
    }
    const association = { port_id: portId, fixed_ip_address: fixedIp };
    if (floatingIpId) {
        const existing = floatingIps.find((ip) => ip.id === floatingIpId);
        if (!existing || existing.port_id || existing.floating_network_id !== externalNetworkId) {
            throw new Error("Floating IP không còn trống hoặc không thuộc External Network đã chọn.");
        }
        const response = await axios.put(`${osClient.networkUrl}/floatingips/${encodeURIComponent(floatingIpId)}`, {
            floatingip: association
        }, osClient.getAuthHeaders());
        return response.data.floatingip;
    }
    // Tạo và gắn trong cùng request; không tạo IP bỏ trống rồi mới gắn.
    const response = await axios.post(`${osClient.networkUrl}/floatingips`, {
        floatingip: { floating_network_id: externalNetworkId, ...association }
    }, osClient.getAuthHeaders());
    return response.data.floatingip;
}
