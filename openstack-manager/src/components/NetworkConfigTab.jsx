
import { useState } from "react";
import { osClient } from "../services/openstackClient";

function NetworkConfigTab() {
    const [networks, setNetworks] = useState([]);
    const [subnets, setSubnets] = useState([]);
    const [routers, setRouters] = useState([]);

    const [routerId, setRouterId] = useState("");
    const [networkId, setNetworkId] = useState("");
    const [subnetId, setSubnetId] = useState("");
    const [externalNetworkId, setExternalNetworkId] = useState("");

    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    // Danh sach External Network
    const externalNetworks = networks.filter(
        (n) => n["router:external"] === true ||
            n.name === "Public_Net"
    );

    // Danh sach Network noi bo
    const internalNetworks = networks.filter(
        (n) => n["router:external"] !== true &&
            n.name !== "Public_Net"
    );

    // Subnet thuoc Network dang chon
    const availableSubnets = subnets.filter(
        (s) => s.network_id === networkId
    );

    // Tai danh sach tai nguyen
    const loadResources = async () => {
        setLoading(true);
        setMessage("");
        setConfig(null);

        try {
            const [networkData, subnetData, routerData] =
                await Promise.all([
                    osClient.getNetworks(),
                    osClient.getSubnets(),
                    osClient.getRouters()
                ]);

            setNetworks(networkData);
            setSubnets(subnetData);
            setRouters(routerData);

            const selectedRouter =
                routerData.find((r) => r.id === routerId) ||
                routerData.find((r) => r.name === "nhom10_router") ||
                routerData[0];

            const privateNetworks = networkData.filter(
                (n) => n["router:external"] !== true &&
                    n.name !== "Public_Net"
            );

            const selectedNetwork =
                privateNetworks.find((n) => n.id === networkId) ||
                privateNetworks.find((n) => n.name === "nhom10_net") ||
                privateNetworks[0];

            const selectedSubnet =
                subnetData.find(
                    (s) =>
                        s.id === subnetId &&
                        s.network_id === selectedNetwork?.id
                ) ||
                subnetData.find(
                    (s) => s.network_id === selectedNetwork?.id
                );

            const publicNetworks = networkData.filter(
                (n) => n["router:external"] === true ||
                    n.name === "Public_Net"
            );

            const selectedExternal =
                publicNetworks.find(
                    (n) => n.id === externalNetworkId
                ) ||
                publicNetworks.find((n) => n.name === "Public_Net") ||
                publicNetworks[0];

            setRouterId(selectedRouter?.id || "");
            setNetworkId(selectedNetwork?.id || "");
            setSubnetId(selectedSubnet?.id || "");
            setExternalNetworkId(selectedExternal?.id || "");

            setMessage("Da tai danh sach tai nguyen thanh cong!");
        } catch (error) {
            setMessage(
                `Loi tai du lieu: ${error.response?.status || error.message}`
            );
        } finally {
            setLoading(false);
        }
    };

    // Lay trang thai cau hinh thuc te
    const readStatus = async () => {
        const [routerData, ports, securityGroups] =
            await Promise.all([
                osClient.getRouters(),
                osClient.getRouterPorts(routerId),
                osClient.getSecurityGroups()
            ]);

        const router = routerData.find(
            (r) => r.id === routerId
        );

        if (!router) {
            throw new Error("Khong tim thay Router.");
        }

        const interfaceConnected = ports.some(
            (port) =>
                port.device_owner?.startsWith("network:router_interface") &&
                port.fixed_ips?.some(
                    (ip) => ip.subnet_id === subnetId
                )
        );

        const securityGroup = securityGroups.find(
            (sg) =>
                sg.name === "default" &&
                (sg.project_id || sg.tenant_id) ===
                (router.project_id || router.tenant_id)
        ) || securityGroups.find(
            (sg) => sg.name === "default"
        );

        return {
            router,
            interfaceConnected,
            securityGroup
        };
    };

    // Kiem tra cau hinh
    const handleCheck = async () => {
        if (!routerId || !networkId || !subnetId || !externalNetworkId) {
            setMessage("Vui long chon day du tai nguyen.");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            const data = await readStatus();
            setConfig(data);
            setMessage("Kiem tra cau hinh thanh cong!");
        } catch (error) {
            setConfig(null);
            setMessage(
                `Loi kiem tra: ${error.response?.status || error.message}`
            );
        } finally {
            setLoading(false);
        }
    };

    const gatewayId =
        config?.router.external_gateway_info?.network_id;

    const gatewayConnected =
        Boolean(config && gatewayId === externalNetworkId);

    // Ket noi External Gateway
    const handleSetGateway = async () => {
        if (!config || loading || gatewayId) return;

        setLoading(true);
        setMessage("");

        try {
            const currentRouters = await osClient.getRouters();
            const router = currentRouters.find(
                (r) => r.id === routerId
            );

            if (!router) {
                throw new Error("Router khong con ton tai.");
            }

            if (router.external_gateway_info?.network_id) {
                setConfig(await readStatus());
                setMessage("Router da co External Gateway.");
                return;
            }

            const network = externalNetworks.find(
                (n) => n.id === externalNetworkId
            );

            if (!network) {
                throw new Error("External Network khong hop le.");
            }

            const confirmed = window.confirm(
                `Ket noi ${router.name} voi ${network.name}?`
            );

            if (!confirmed) return;

            await osClient.setRouterExternalGateway(
                routerId,
                externalNetworkId
            );

            setConfig(await readStatus());
            setMessage("Cau hinh External Gateway thanh cong!");
        } catch (error) {
            setMessage(
                `Loi: ${error.response?.status || error.message}`
            );
        } finally {
            setLoading(false);
        }
    };

    // Ket noi Router voi Subnet
    const handleAddInterface = async () => {
        if (!config || loading || config.interfaceConnected) return;

        setLoading(true);
        setMessage("");

        try {
            const currentSubnets = await osClient.getSubnets();
            const subnet = currentSubnets.find(
                (s) => s.id === subnetId &&
                    s.network_id === networkId
            );

            if (!subnet) {
                throw new Error("Subnet khong con hop le.");
            }

            const ports = await osClient.getRouterPorts(routerId);

            const exists = ports.some(
                (port) =>
                    port.device_owner?.startsWith("network:router_interface") &&
                    port.fixed_ips?.some(
                        (ip) => ip.subnet_id === subnetId
                    )
            );

            if (exists) {
                setConfig(await readStatus());
                setMessage("Router da ket noi voi Subnet nay.");
                return;
            }

            const confirmed = window.confirm(
                `Ket noi Router voi Subnet ${subnet.name}?`
            );

            if (!confirmed) return;

            await osClient.addRouterInterface(routerId, subnetId);

            setConfig(await readStatus());
            setMessage("Ket noi Router Interface thanh cong!");
        } catch (error) {
            setMessage(
                `Loi: ${error.response?.status || error.message}`
            );
        } finally {
            setLoading(false);
        }
    };

    const selectedRouter = routers.find(
        (r) => r.id === routerId
    );

    const selectedNetwork = networks.find(
        (n) => n.id === networkId
    );

    const selectedSubnet = subnets.find(
        (s) => s.id === subnetId
    );

    const selectedExternal = networks.find(
        (n) => n.id === externalNetworkId
    );

    return (
        <div style={{ padding: 30, maxWidth: 950, margin: "auto" }}>
            <h2>Network Configuration - Cau 5</h2>

            <button onClick={loadResources} disabled={loading}>
                Tai danh sach tai nguyen
            </button>

            <h3>1. Chon tai nguyen</h3>

            <p>Router</p>
            <select
                value={routerId}
                onChange={(e) => {
                    setRouterId(e.target.value);
                    setConfig(null);
                }}
                disabled={loading}
            >
                <option value="">-- Chon Router --</option>
                {routers.map((router) => (
                    <option key={router.id} value={router.id}>
                        {router.name}
                    </option>
                ))}
            </select>

            <p>Network noi bo</p>
            <select
                value={networkId}
                onChange={(e) => {
                    const id = e.target.value;
                    setNetworkId(id);
                    setSubnetId(
                        subnets.find((s) => s.network_id === id)?.id || ""
                    );
                    setConfig(null);
                }}
                disabled={loading}
            >
                <option value="">-- Chon Network --</option>
                {internalNetworks.map((network) => (
                    <option key={network.id} value={network.id}>
                        {network.name}
                    </option>
                ))}
            </select>

            <p>Subnet</p>
            <select
                value={subnetId}
                onChange={(e) => {
                    setSubnetId(e.target.value);
                    setConfig(null);
                }}
                disabled={loading}
            >
                <option value="">-- Chon Subnet --</option>
                {availableSubnets.map((subnet) => (
                    <option key={subnet.id} value={subnet.id}>
                        {subnet.name} - {subnet.cidr}
                    </option>
                ))}
            </select>

            <p>External Network</p>
            <select
                value={externalNetworkId}
                onChange={(e) => {
                    setExternalNetworkId(e.target.value);
                    setConfig(null);
                }}
                disabled={loading}
            >
                <option value="">-- Chon External Network --</option>
                {externalNetworks.map((network) => (
                    <option key={network.id} value={network.id}>
                        {network.name}
                    </option>
                ))}
            </select>

            <br />
            <br />

            <button onClick={handleCheck} disabled={loading}>
                Kiem tra cau hinh
            </button>

            <p>{message}</p>

            {config && (
                <>
                    <hr />

                    <h3>2. External Gateway</h3>
                    <p>Router: {selectedRouter?.name}</p>
                    <p>External Network: {selectedExternal?.name}</p>
                    <p>
                        Trang thai:{" "}
                        {gatewayConnected
                            ? "Da ket noi"
                            : gatewayId
                                ? "Dang ket noi voi External Network khac"
                                : "Chua ket noi"}
                    </p>

                    <button
                        onClick={handleSetGateway}
                        disabled={loading || Boolean(gatewayId)}
                    >
                        Ket noi External Gateway
                    </button>

                    <hr />

                    <h3>3. Router Interface</h3>
                    <p>Network: {selectedNetwork?.name}</p>
                    <p>Subnet: {selectedSubnet?.name}</p>
                    <p>CIDR: {selectedSubnet?.cidr}</p>
                    <p>
                        Trang thai:{" "}
                        {config.interfaceConnected
                            ? "Da ket noi"
                            : "Chua ket noi"}
                    </p>

                    <button
                        onClick={handleAddInterface}
                        disabled={loading || config.interfaceConnected}
                    >
                        Ket noi Router voi Subnet
                    </button>

                    <hr />

                    <h3>4. Security Group</h3>

                    {config.securityGroup ? (
                        <>
                            <p>
                                Security Group: {config.securityGroup.name}
                            </p>

                            <table border="1" cellPadding="10" width="100%">
                                <thead>
                                    <tr>
                                        <th>STT</th>
                                        <th>Direction</th>
                                        <th>Protocol</th>
                                        <th>Port</th>
                                        <th>Remote IP / Group</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {(config.securityGroup.security_group_rules || [])
                                        .map((rule, index) => (
                                            <tr key={rule.id}>
                                                <td>{index + 1}</td>
                                                <td>{rule.direction}</td>
                                                <td>{rule.protocol || "Any"}</td>
                                                <td>
                                                    {rule.port_range_min == null
                                                        ? "Any / N/A"
                                                        : rule.port_range_min === rule.port_range_max
                                                            ? rule.port_range_min
                                                            : `${rule.port_range_min}-${rule.port_range_max}`}
                                                </td>
                                                <td>
                                                    {rule.remote_ip_prefix ||
                                                        (rule.remote_group_id
                                                            ? "Cung Security Group"
                                                            : "Khong chi dinh")}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </>
                    ) : (
                        <p>Khong tim thay Security Group default.</p>
                    )}
                </>
            )}
        </div>
    );
}

export default NetworkConfigTab;
