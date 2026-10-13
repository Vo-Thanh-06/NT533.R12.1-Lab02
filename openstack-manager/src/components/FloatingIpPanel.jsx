import { useRef, useState } from "react";
import { osClient } from "../services/openstackClient";
import { attachFloatingIp, getFloatingIps, getInstancePorts } from "../services/webServerService";

const fieldStyle = { display: "block", width: "100%", maxWidth: 540, padding: 8, margin: "6px 0 14px" };

function FloatingIpPanel({ instances }) {
    const [networks, setNetworks] = useState([]);
    const [floatingIps, setFloatingIps] = useState([]);
    const [groups, setGroups] = useState([]);
    const [serverId, setServerId] = useState("");
    const [ports, setPorts] = useState([]);
    const [portSelection, setPortSelection] = useState("");
    const [externalNetworkId, setExternalNetworkId] = useState("");
    const [floatingIpId, setFloatingIpId] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const busy = useRef(false);
    const [portId, fixedIp] = portSelection.split("|");
    const selectedPort = ports.find((port) => port.id === portId);
    const selectedServer = instances.find((server) => server.id === serverId);
    const attachedIps = floatingIps.filter((ip) => ports.some((port) => port.id === ip.port_id));

    const run = async (action) => {
        if (busy.current) return;
        busy.current = true;
        setLoading(true);
        setMessage("");
        try {
            osClient.getAuthHeaders();
            await action();
        } catch (error) {
            const status = error.response?.status;
            setMessage(status === 401 ? "Phiên đăng nhập hết hạn hoặc không hợp lệ. Đăng nhập lại ở Authentication (tải lại trang nếu cần)." :
                !osClient.token ? "Vui lòng đăng nhập trước." :
                    status ? `HTTP ${status}: Kiểm tra quyền, quota và kết nối router. Tải lại dữ liệu trước khi thử lại.` :
                        error.request ? "Không nhận được phản hồi. Tải lại Floating IP để kiểm tra trước khi thử gắn lại." : error.message);
        } finally {
            busy.current = false;
            setLoading(false);
        }
    };

    const refresh = () => run(async () => {
        const [networkData, ips, groupData] = await Promise.all([
            osClient.getNetworks(), getFloatingIps(), osClient.getSecurityGroups()
        ]);
        setNetworks(networkData.filter((network) => network["router:external"] === true));
        setFloatingIps(ips);
        setGroups(groupData);
        setFloatingIpId("");
        setMessage("Đã tải External Network và Floating IP.");
    });

    const loadPorts = () => run(async () => {
        const data = await getInstancePorts(serverId);
        setPorts(data);
        setPortSelection("");
        setMessage(data.length ? "Đã tải port/IP nội bộ." : "VM chưa có port compute. Kiểm tra trạng thái rồi tải lại.");
    });

    const attach = (event) => {
        event.preventDefault();
        if (busy.current) return;
        if (selectedServer?.status !== "ACTIVE" || !selectedPort || !externalNetworkId) {
            setMessage("Chọn VM ACTIVE, port/IPv4 nội bộ và External Network.");
            return;
        }
        if (!window.confirm(`${floatingIpId ? "Gắn Floating IP đang trống" : "Cấp và gắn Floating IP mới"} vào VM "${selectedServer.name}", IP nội bộ ${fixedIp}?`)) return;
        run(async () => {
            const ip = await attachFloatingIp({ serverId, portId, fixedIp, externalNetworkId, floatingIpId });
            setFloatingIps((current) => [...current.filter((item) => item.id !== ip.id), ip]);
            setFloatingIpId("");
            setMessage(`Đã gắn Floating IP ${ip.floating_ip_address}.`);
        });
    };

    return (
        <details style={{ margin: "20px 0" }}>
            <summary>Gắn Floating IP và truy cập Web Server – Câu 6</summary>
            <p role="status" aria-live="polite" style={{ overflowWrap: "anywhere" }}>{message}</p>
            <fieldset disabled={loading} style={{ border: 0, padding: 0, minWidth: 0 }}>
                <button type="button" onClick={refresh}>{loading ? "Đang xử lý..." : "Tải / Làm mới Floating IP & External Network"}</button>
                <form onSubmit={attach}>
                    <label htmlFor="floating-server">VM</label>
                    <select id="floating-server" required value={serverId} onChange={(event) => { setServerId(event.target.value); setPorts([]); setPortSelection(""); }} style={fieldStyle}>
                        <option value="">-- Chọn VM ACTIVE --</option>
                        {instances.map((server) => <option key={server.id} value={server.id} disabled={server.status !== "ACTIVE"}>{server.name} – {server.status} ({server.id})</option>)}
                    </select>
                    <button type="button" onClick={loadPorts} disabled={selectedServer?.status !== "ACTIVE"}>Tải port/IP nội bộ</button>
                    <label htmlFor="floating-port">Port / IPv4 nội bộ</label>
                    <select id="floating-port" required value={portSelection} onChange={(event) => setPortSelection(event.target.value)} style={fieldStyle}>
                        <option value="">-- Chọn port / IPv4 --</option>
                        {ports.flatMap((port) => (port.fixed_ips || []).filter((ip) => !ip.ip_address.includes(":")).map((ip) =>
                            <option key={`${port.id}|${ip.ip_address}`} value={`${port.id}|${ip.ip_address}`}>{ip.ip_address} – port {port.id}</option>
                        ))}
                    </select>
                    {selectedPort && <p>Security Group trên port: {(selectedPort.security_groups || []).map((id) => groups.find((group) => group.id === id)?.name || id).join(", ") || "Không có"}.</p>}
                    <label htmlFor="floating-external">External Network</label>
                    <select id="floating-external" required value={externalNetworkId} onChange={(event) => { setExternalNetworkId(event.target.value); setFloatingIpId(""); }} style={fieldStyle}>
                        <option value="">-- Chọn External Network --</option>
                        {networks.map((network) => <option key={network.id} value={network.id}>{network.name} ({network.id})</option>)}
                    </select>
                    <label htmlFor="floating-ip">Floating IP</label>
                    <select id="floating-ip" value={floatingIpId} onChange={(event) => setFloatingIpId(event.target.value)} style={fieldStyle}>
                        <option value="">Cấp Floating IP mới và gắn vào VM</option>
                        {floatingIps.filter((ip) => !ip.port_id && ip.floating_network_id === externalNetworkId).map((ip) => <option key={ip.id} value={ip.id}>Dùng IP đang trống: {ip.floating_ip_address}</option>)}
                    </select>
                    <button type="submit" disabled={!portSelection || !externalNetworkId || selectedServer?.status !== "ACTIVE"}>Gắn Floating IP</button>
                </form>
                {attachedIps.map((ip) => <p key={ip.id}>Floating IP: <a href={`http://${ip.floating_ip_address}/`} target="_blank" rel="noreferrer">http://{ip.floating_ip_address}/</a> – {ip.status || "Chưa rõ trạng thái"}</p>)}
            </fieldset>
        </details>
    );
}

export default FloatingIpPanel;
