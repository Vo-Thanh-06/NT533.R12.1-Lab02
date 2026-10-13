
import { useState } from "react";
import { osClient } from "../services/openstackClient";

function LoadBalancerTab() {
    const [loadBalancers, setLoadBalancers] = useState([]);
    const [listeners, setListeners] = useState([]);
    const [pools, setPools] = useState([]);
    const [members, setMembers] = useState({});
    const [healthMonitors, setHealthMonitors] = useState([]);
    const [floatingIps, setFloatingIps] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState("");

    const loadData = async () => {
        setLoading(true);
        setError("");
        setLoaded(false);

        try {
            const [
                lbData,
                listenerData,
                poolData,
                monitorData,
                floatingIpData
            ] = await Promise.all([
                osClient.getLoadBalancers(),
                osClient.getListeners(),
                osClient.getPools(),
                osClient.getHealthMonitors(),
                osClient.getFloatingIps()
            ]);

            const memberData = {};

            for (const pool of poolData) {
                memberData[pool.id] =
                    await osClient.getPoolMembers(pool.id);
            }

            setLoadBalancers(lbData);
            setListeners(listenerData);
            setPools(poolData);
            setMembers(memberData);
            setHealthMonitors(monitorData);
            setFloatingIps(floatingIpData);
            setLoaded(true);
        } catch (err) {
            setError(
                err.response?.data?.faultstring ||
                err.response?.data?.error?.message ||
                err.message ||
                "Không thể tải dữ liệu Load Balancer."
            );
        } finally {
            setLoading(false);
        }
    };

    const getFloatingIp = (loadBalancer) => {
        const floatingIp = floatingIps.find(
            (ip) => ip.port_id === loadBalancer.vip_port_id
        );

        return floatingIp?.floating_ip_address || "Chưa gán";
    };

    const getStatusColor = (status) => {
        if (status === "ONLINE" || status === "ACTIVE") {
            return "#16803c";
        }

        if (status === "ERROR" || status === "OFFLINE") {
            return "#dc2626";
        }

        return "#b7791f";
    };

    const renderStatus = (status) => (
        <strong style={{ color: getStatusColor(status) }}>
            {status || "N/A"}
        </strong>
    );

    const sectionStyle = {
        width: "calc(100% - 40px)",
        maxWidth: "1100px",
        margin: "30px auto",
        padding: "20px",
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif"
    };

    const tableWrapperStyle = {
        width: "100%",
        overflowX: "auto",
        marginBottom: "25px"
    };

    const tableStyle = {
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "14px"
    };

    const headerStyle = {
        border: "1px solid #d1d5db",
        padding: "12px",
        textAlign: "left",
        backgroundColor: "#e8f2fb",
        color: "#1f2937",
        whiteSpace: "nowrap"
    };

    const cellStyle = {
        border: "1px solid #d1d5db",
        padding: "12px",
        textAlign: "left",
        whiteSpace: "nowrap"
    };

    const titleStyle = {
        marginTop: "30px",
        marginBottom: "15px",
        color: "#1f2937",
        fontSize: "19px"
    };

    const emptyRow = (colSpan) => (
        <tr>
            <td
                colSpan={colSpan}
                style={{
                    ...cellStyle,
                    textAlign: "center",
                    color: "#6b7280"
                }}
            >
                {loaded
                    ? "Không có dữ liệu."
                    : "Nhấn nút tải dữ liệu để xem thông tin."}
            </td>
        </tr>
    );

    return (
        <section style={sectionStyle}>
            <h2
                style={{
                    textAlign: "center",
                    marginBottom: "15px",
                    color: "#111827"
                }}
            >
                Câu 7 - Quản lý Load Balancer
            </h2>

            <p
                style={{
                    textAlign: "center",
                    color: "#4b5563",
                    marginBottom: "25px"
                }}
            >
                Quản lý và theo dõi Load Balancer, Listener,
                Pool, Web Server và Health Monitor trên OpenStack.
            </p>

            <div style={{ textAlign: "center", marginBottom: "25px" }}>
                <button
                    onClick={loadData}
                    disabled={loading}
                    style={{
                        padding: "4px 10px",
                        backgroundColor: loading ? "#f0f0f0" : "#ffffff",
                        color: loading ? "#999999" : "#000000",
                        border: "1px solid #999999",
                        borderRadius: "2px",
                        cursor: loading ? "not-allowed" : "pointer",
                        fontSize: "13px",
                        fontWeight: "normal"
                    }}
                >
                    {loading
                        ? "Đang tải dữ liệu..."
                        : "Tải dữ liệu Load Balancer"}
                </button>
            </div>

            {error && (
                <p
                    style={{
                        color: "#dc2626",
                        padding: "12px",
                        border: "1px solid #fecaca",
                        borderRadius: "5px",
                        marginBottom: "20px"
                    }}
                >
                    Lỗi: {error}
                </p>
            )}

            <h3 style={titleStyle}>
                1. Danh sách Load Balancer
            </h3>

            <div style={tableWrapperStyle}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            {[
                                "Tên",
                                "VIP",
                                "Floating IP",
                                "Provider",
                                "Provisioning",
                                "Operating"
                            ].map((title) => (
                                <th key={title} style={headerStyle}>
                                    {title}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {loadBalancers.length > 0
                            ? loadBalancers.map((lb) => (
                                <tr key={lb.id}>
                                    <td style={cellStyle}>{lb.name}</td>
                                    <td style={cellStyle}>
                                        {lb.vip_address}
                                    </td>
                                    <td style={cellStyle}>
                                        {getFloatingIp(lb)}
                                    </td>
                                    <td style={cellStyle}>
                                        {lb.provider || "N/A"}
                                    </td>
                                    <td style={cellStyle}>
                                        {renderStatus(lb.provisioning_status)}
                                    </td>
                                    <td style={cellStyle}>
                                        {renderStatus(lb.operating_status)}
                                    </td>
                                </tr>
                            ))
                            : emptyRow(6)}
                    </tbody>
                </table>
            </div>

            <h3 style={titleStyle}>
                2. Danh sách Listener
            </h3>

            <div style={tableWrapperStyle}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            {[
                                "Tên",
                                "Giao thức",
                                "Cổng",
                                "Provisioning",
                                "Operating"
                            ].map((title) => (
                                <th key={title} style={headerStyle}>
                                    {title}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {listeners.length > 0
                            ? listeners.map((listener) => (
                                <tr key={listener.id}>
                                    <td style={cellStyle}>
                                        {listener.name}
                                    </td>
                                    <td style={cellStyle}>
                                        {listener.protocol}
                                    </td>
                                    <td style={cellStyle}>
                                        {listener.protocol_port}
                                    </td>
                                    <td style={cellStyle}>
                                        {renderStatus(
                                            listener.provisioning_status
                                        )}
                                    </td>
                                    <td style={cellStyle}>
                                        {renderStatus(
                                            listener.operating_status
                                        )}
                                    </td>
                                </tr>
                            ))
                            : emptyRow(5)}
                    </tbody>
                </table>
            </div>

            <h3 style={titleStyle}>
                3. Danh sách Pool
            </h3>

            <div style={tableWrapperStyle}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            {[
                                "Tên",
                                "Giao thức",
                                "Thuật toán",
                                "Provisioning",
                                "Operating"
                            ].map((title) => (
                                <th key={title} style={headerStyle}>
                                    {title}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {pools.length > 0
                            ? pools.map((pool) => (
                                <tr key={pool.id}>
                                    <td style={cellStyle}>{pool.name}</td>
                                    <td style={cellStyle}>
                                        {pool.protocol}
                                    </td>
                                    <td style={cellStyle}>
                                        {pool.lb_algorithm}
                                    </td>
                                    <td style={cellStyle}>
                                        {renderStatus(pool.provisioning_status)}
                                    </td>
                                    <td style={cellStyle}>
                                        {renderStatus(pool.operating_status)}
                                    </td>
                                </tr>
                            ))
                            : emptyRow(5)}
                    </tbody>
                </table>
            </div>

            <h3 style={titleStyle}>
                4. Danh sách Web Server trong Pool
            </h3>

            {pools.length === 0 && (
                <p style={{ color: "#6b7280" }}>
                    {loaded
                        ? "Không có Pool để hiển thị Web Server."
                        : "Nhấn nút tải dữ liệu để xem các Web Server."}
                </p>
            )}

            {pools.map((pool) => (
                <div key={pool.id}>
                    <h4
                        style={{
                            marginTop: "15px",
                            marginBottom: "10px"
                        }}
                    >
                        Pool: {pool.name}
                    </h4>

                    <div style={tableWrapperStyle}>
                        <table style={tableStyle}>
                            <thead>
                                <tr>
                                    {[
                                        "Địa chỉ IP",
                                        "Cổng",
                                        "Trọng số",
                                        "Provisioning",
                                        "Operating"
                                    ].map((title) => (
                                        <th
                                            key={title}
                                            style={headerStyle}
                                        >
                                            {title}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            <tbody>
                                {(members[pool.id] || []).length > 0
                                    ? members[pool.id].map((member) => (
                                        <tr key={member.id}>
                                            <td style={cellStyle}>
                                                {member.address}
                                            </td>
                                            <td style={cellStyle}>
                                                {member.protocol_port}
                                            </td>
                                            <td style={cellStyle}>
                                                {member.weight}
                                            </td>
                                            <td style={cellStyle}>
                                                {renderStatus(
                                                    member.provisioning_status
                                                )}
                                            </td>
                                            <td style={cellStyle}>
                                                {renderStatus(
                                                    member.operating_status
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                    : emptyRow(5)}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}

            <h3 style={titleStyle}>
                5. Danh sách Health Monitor
            </h3>

            <div style={tableWrapperStyle}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            {[
                                "Tên",
                                "Loại",
                                "Chu kỳ (giây)",
                                "Timeout (giây)",
                                "Số lần thử lại",
                                "Phương thức HTTP",
                                "Đường dẫn URL",
                                "Mã phản hồi"
                            ].map((title) => (
                                <th key={title} style={headerStyle}>
                                    {title}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {healthMonitors.length > 0
                            ? healthMonitors.map((monitor) => (
                                <tr key={monitor.id}>
                                    <td style={cellStyle}>
                                        {monitor.name}
                                    </td>
                                    <td style={cellStyle}>
                                        {monitor.type}
                                    </td>
                                    <td style={cellStyle}>
                                        {monitor.delay}
                                    </td>
                                    <td style={cellStyle}>
                                        {monitor.timeout}
                                    </td>
                                    <td style={cellStyle}>
                                        {monitor.max_retries}
                                    </td>
                                    <td style={cellStyle}>
                                        {monitor.http_method || "N/A"}
                                    </td>
                                    <td style={cellStyle}>
                                        {monitor.url_path || "N/A"}
                                    </td>
                                    <td style={cellStyle}>
                                        {monitor.expected_codes || "N/A"}
                                    </td>
                                </tr>
                            ))
                            : emptyRow(8)}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

export default LoadBalancerTab;
