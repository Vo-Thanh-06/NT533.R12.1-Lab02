import { useRef, useState } from "react";
import { osClient } from "../services/openstackClient";
import { createInstance, getInstances } from "../services/instanceService";
import { buildWebUserData } from "../services/webUserData";
import { allowsPublicHttp, ensureHttpRule } from "../services/webServerService";
import FloatingIpPanel from "./FloatingIpPanel";

function errorMessage(error) {
    const status = error.response?.status;
    if (status === 401) return "Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại ở phần Authentication (tải lại trang nếu cần).";
    if (status === 403) return "HTTP 403: Không có quyền thực hiện thao tác hoặc cấu hình VM không được cho phép.";
    if (!osClient.token) return "Vui lòng đăng nhập OpenStack ở phần Authentication trước.";
    if (!error.response && error.request) return "Không nhận được phản hồi. Nếu vừa tạo VM, hãy làm mới danh sách trước khi thử tạo lại để tránh trùng VM.";
    return status ? `Yêu cầu thất bại (HTTP ${status}). Kiểm tra tài nguyên, cấu hình và quota của project.` : error.message;
}

const fieldStyle = { display: "block", padding: 10, width: "100%", maxWidth: 420, marginTop: 6 };

function InstanceTab() {
    const [instances, setInstances] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [images, setImages] = useState([]);
    const [flavors, setFlavors] = useState([]);
    const [networks, setNetworks] = useState([]);
    const [webEnabled, setWebEnabled] = useState(false);
    const [groups, setGroups] = useState([]);
    const [form, setForm] = useState({
        name: "", imageId: "", flavorId: "", networkId: "", volumeSize: "10", securityGroupId: "",
        groupInfo: "Nhóm 10 – NT533 Lab 02\nTrần Phú Thành\nVõ Diệp Thành\nNguyễn Nhật Thanh\nNguyễn Nhật Long Hưng"
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const busy = useRef(false);
    const selectedImage = images.find((image) => image.id === form.imageId);
    const minVolume = Math.max(1, Number(selectedImage?.min_disk) || 0);
    const selectedGroup = groups.find((group) => group.id === form.securityGroupId);

    const updateField = (event) => {
        const { name, value } = event.target;
        setForm((current) => ({ ...current, [name]: value }));
    };

    const run = async (action) => {
        if (busy.current) return;
        busy.current = true;
        setLoading(true);
        setMessage("");
        try {
            osClient.getAuthHeaders();
            await action();
        } catch (error) {
            setMessage(errorMessage(error));
        } finally {
            busy.current = false;
            setLoading(false);
        }
    };

    const loadInstances = () => run(async () => {
        const data = await getInstances();
        setInstances(data);
        setLoaded(true);
        setMessage(`Đã tải ${data.length} Instance.`);
    });

    const loadResources = () => run(async () => {
        const [imageData, flavorData, networkData] = await Promise.all([
            osClient.getImages(), osClient.getFlavors(), osClient.getNetworks()
        ]);
        const activeImages = imageData.filter((image) => image.status === "active");
        const internalNetworks = networkData.filter((network) => network["router:external"] !== true);
        setImages(activeImages);
        setFlavors(flavorData);
        setNetworks(internalNetworks);
        // Xóa lựa chọn không còn tồn tại sau khi tải lại tài nguyên.
        setForm((current) => ({
            ...current,
            imageId: activeImages.some((image) => image.id === current.imageId) ? current.imageId : "",
            flavorId: flavorData.some((flavor) => flavor.id === current.flavorId) ? current.flavorId : "",
            networkId: internalNetworks.some((network) => network.id === current.networkId) ? current.networkId : ""
        }));
        setMessage(`Đã tải ${activeImages.length} Image active, ${flavorData.length} Flavor và ${internalNetworks.length} Network nội bộ.`);
    });

    const loadGroups = () => run(async () => {
        const data = await osClient.getSecurityGroups();
        setGroups(data);
        setForm((current) => ({ ...current, securityGroupId: data.some((group) => group.id === current.securityGroupId) ? current.securityGroupId : "" }));
        setMessage(`Đã tải ${data.length} Security Group.`);
    });

    const openHttp = () => {
        if (busy.current || !selectedGroup) return;
        if (!window.confirm(`Cho phép TCP cổng 80 từ 0.0.0.0/0 vào Security Group "${selectedGroup.name}"? Rule áp dụng cho mọi VM dùng group này.`)) return;
        run(async () => {
            const result = await ensureHttpRule(selectedGroup.id);
            setMessage(result.created ? "Đã thêm rule HTTP cổng 80. Bấm Tải Security Group để cập nhật trạng thái." : "Security Group đã cho phép HTTP IPv4 từ bên ngoài.");
            // Việc tải lại thất bại không được làm mất thông báo thao tác ghi đã thành công.
            try {
                setGroups(await osClient.getSecurityGroups());
            } catch {
                setMessage("Security Group đã cho phép HTTP, nhưng chưa tải lại được danh sách. Bấm Tải Security Group để kiểm tra.");
            }
        });
    };

    const handleCreate = (event) => {
        event.preventDefault();
        if (busy.current) return;
        if (!selectedImage || !flavors.some((flavor) => flavor.id === form.flavorId) || !networks.some((network) => network.id === form.networkId)) {
            setMessage("Vui lòng tải tài nguyên và chọn Image, Flavor, Network hợp lệ.");
            return;
        }
        if (!form.name.trim() || !Number.isSafeInteger(Number(form.volumeSize)) || Number(form.volumeSize) < minVolume) {
            setMessage(`Nhập tên Instance và dung lượng volume là số nguyên, ít nhất ${minVolume} GB.`);
            return;
        }
        if (!osClient.token) {
            setMessage("Vui lòng đăng nhập OpenStack trước.");
            return;
        }
        if (webEnabled && (!selectedGroup || !form.groupInfo.trim())) {
            setMessage("Chọn Security Group và nhập thông tin nhóm cho Web Server.");
            return;
        }
        if (!window.confirm(`Tạo VM thật "${form.name.trim()}" với boot volume ${form.volumeSize} GB${webEnabled ? " và User Data tự cài Nginx (cần Ubuntu có cloud-init)" : ""} trên OpenStack?`)) return;
        run(async () => {
            const server = await createInstance({
                ...form,
                securityGroupId: webEnabled ? form.securityGroupId : undefined,
                userData: webEnabled ? buildWebUserData(form.groupInfo) : undefined
            });
            setForm((current) => ({ ...current, name: "" }));
            setMessage(`Đã tiếp nhận yêu cầu tạo Instance. ID: ${server.id}.`);
        });
    };

    return (
        <section style={{ padding: 30, maxWidth: 950, margin: "auto" }} aria-labelledby="instance-heading">
            <h2 id="instance-heading">Instance Management – Câu 4 & Câu 6</h2>
            <button type="button" onClick={loadInstances} disabled={loading}>
                {loading ? "Đang xử lý..." : "Liệt kê / Làm mới danh sách"}
            </button>
            <p role="status" aria-live="polite" style={{ overflowWrap: "anywhere" }}>{message}</p>

            {loaded && (instances.length === 0 ? <p>Chưa có Instance trong project.</p> : (
                <div style={{ overflowX: "auto" }}>
                    <table border="1" cellPadding="10" style={{ width: "100%", borderCollapse: "collapse" }}>
                        <caption>Danh sách Instance</caption>
                        <thead><tr><th scope="col">Tên VM</th><th scope="col">ID</th><th scope="col">Trạng thái</th><th scope="col">Flavor ID</th><th scope="col">Network / IP</th></tr></thead>
                        <tbody>{instances.map((server) => (
                            <tr key={server.id}>
                                <td>{server.name}</td>
                                <td style={{ overflowWrap: "anywhere" }}>{server.id}</td>
                                <td>{server.status || "Chưa rõ"}</td>
                                <td>{server.flavor?.id || "—"}</td>
                                <td>{Object.keys(server.addresses || {}).length ? Object.entries(server.addresses).map(([network, addresses]) => (
                                    <div key={network}>{network}: {addresses.map((address) => `${address.addr} (${address["OS-EXT-IPS:type"] || "IP"})`).join(", ") || "Chưa có IP"}</div>
                                )) : "Chưa có IP"}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            ))}

            <FloatingIpPanel instances={instances} />

            <h3>Tạo Instance mới</h3>
            <button type="button" onClick={loadResources} disabled={loading}>Tải / Làm mới tài nguyên</button>
            <form onSubmit={handleCreate}>
                <fieldset disabled={loading} style={{ border: 0, padding: 0 }}>
                    <div style={{ marginBottom: 12 }}>
                        <label htmlFor="instance-name">Tên Instance</label>
                        <input id="instance-name" name="name" value={form.name} onChange={updateField} required maxLength={255} style={fieldStyle} />
                    </div>
                    {[
                        { name: "imageId", label: "Image (active)", data: images },
                        { name: "flavorId", label: "Flavor", data: flavors },
                        { name: "networkId", label: "Network nội bộ", data: networks }
                    ].map(({ name, label, data }) => (
                        <div key={name} style={{ marginBottom: 12 }}>
                            <label htmlFor={`instance-${name}`}>{label}</label>
                            <select id={`instance-${name}`} name={name} value={form[name]} onChange={updateField} required style={fieldStyle}>
                                <option value="">-- Chọn {label} --</option>
                                {data.map((item) => <option key={item.id} value={item.id}>{item.name || item.id} ({item.id})</option>)}
                            </select>
                        </div>
                    ))}
                    <div style={{ marginBottom: 12 }}>
                        <label htmlFor="instance-volume">Dung lượng boot volume (GB), tối thiểu {minVolume} GB</label>
                        <input id="instance-volume" type="number" name="volumeSize" min={minVolume} step="1" required value={form.volumeSize} onChange={updateField} style={fieldStyle} />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                        <label htmlFor="instance-web-enabled">
                            <input id="instance-web-enabled" type="checkbox" checked={webEnabled} onChange={(event) => setWebEnabled(event.target.checked)} />
                            {" "}Cài Web Server bằng User Data (Câu 6)
                        </label>
                    </div>
                    {webEnabled && (
                        <div style={{ marginBottom: 16 }}>
                            <button type="button" onClick={loadGroups}>Tải Security Group</button>
                            <div style={{ margin: "12px 0" }}>
                                <label htmlFor="instance-security-group">Security Group cho VM Web</label>
                                <select id="instance-security-group" name="securityGroupId" required value={form.securityGroupId} onChange={updateField} style={fieldStyle}>
                                    <option value="">-- Chọn Security Group --</option>
                                    {groups.map((group) => <option key={group.id} value={group.id}>{group.name} ({group.id})</option>)}
                                </select>
                            </div>
                            {selectedGroup && <p>{allowsPublicHttp(selectedGroup) ? "Đã cho phép HTTP IPv4 từ bên ngoài." : "Chưa thấy rule cho phép HTTP IPv4 từ mọi địa chỉ."}</p>}
                            <button type="button" onClick={openHttp} disabled={!selectedGroup || allowsPublicHttp(selectedGroup)}>Cho phép HTTP cổng 80</button>
                            <label htmlFor="instance-group-info">Thông tin nhóm</label>
                            <textarea id="instance-group-info" name="groupInfo" required rows={6} maxLength={8000} value={form.groupInfo} onChange={updateField} style={fieldStyle} />
                            <details style={{ marginTop: 12 }}>
                                <summary>Xem User Data</summary>
                                <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{form.groupInfo.trim() ? buildWebUserData(form.groupInfo) : "Nhập thông tin nhóm để tạo User Data."}</pre>
                            </details>
                        </div>
                    )}
                    <button type="submit" disabled={!images.length || !flavors.length || !networks.length}>Tạo Instance</button>
                </fieldset>
            </form>
        </section>
    );
}

export default InstanceTab;
