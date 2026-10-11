
import { useState } from "react";
import { osClient } from "../services/openstackClient";

function NetworkTab() {
    const [networks, setNetworks] = useState([]);
    const [selectedNetworkId, setSelectedNetworkId] = useState("");
    const [newSubnetName, setNewSubnetName] = useState("nhom10_subnet");
    const [newSubnetCidr, setNewSubnetCidr] = useState("192.168.10.0/24");
    const [newNetworkName, setNewNetworkName] = useState("nhom10_net");
    const [subnets, setSubnets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const loadNetworks = async () => {
        setLoading(true);
        setMessage("");

        try {
            const data = await osClient.getNetworks();
            setNetworks(data);
            setMessage(`Tim thay ${data.length} Network.`);
        } catch (error) {
            setMessage(
                `Loi lay Network: ${error.response?.status || error.message}`
            );
        } finally {
            setLoading(false);
        }
    };

    const loadSubnets = async () => {
        setLoading(true);
        setMessage("");

        try {
            const data = await osClient.getSubnets();
            setSubnets(data);
            setMessage(`Tim thay ${data.length} Subnet.`);
        } catch (error) {
            setMessage(
                `Loi lay Subnet: ${error.response?.status || error.message}`
            );
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNetwork = async (e) => {
        e.preventDefault();

        const name = newNetworkName.trim();

        if (!name) {
            setMessage("Vui long nhap ten Network.");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            const network = await osClient.createNetwork(name);

            const data = await osClient.getNetworks();
            setNetworks(data);

            setMessage(`Tao Network ${network.name} thanh cong!`);
            setNewNetworkName("");

        } catch (error) {
            setMessage(
                `Loi tao Network: ${error.response?.status || error.message}`
            );
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSubnet = async (e) => {
        e.preventDefault();

        if (!selectedNetworkId) {
            setMessage("Vui long chon Network.");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            // Kiem tra Subnet da ton tai hay chua
            const existingSubnets = await osClient.getSubnets();

            const exists = existingSubnets.some(
                (subnet) =>
                    subnet.network_id === selectedNetworkId &&
                    (subnet.name === newSubnetName.trim() ||
                        subnet.cidr === newSubnetCidr.trim())
            );

            if (exists) {
                setSubnets(existingSubnets);
                setMessage("Subnet da ton tai trong Network nay.");
                return;
            }

            // Tao Subnet moi
            const subnet = await osClient.createSubnet(
                selectedNetworkId,
                newSubnetName.trim(),
                newSubnetCidr.trim()
            );

            // Cap nhat danh sach Subnet
            const data = await osClient.getSubnets();
            setSubnets(data);

            setMessage(`Tao Subnet ${subnet.name} thanh cong!`);

        } catch (error) {
            setMessage(
                `Loi tao Subnet: ${error.response?.status || error.message}`
            );
        } finally {
            setLoading(false);
        }
    };


    const isTestNetwork = (network) => {
        const mainNetwork = networks.find(
            (n) => n.name === "nhom10_net"
        );

        const projectId =
            mainNetwork?.project_id || mainNetwork?.tenant_id;

        const ownerId =
            network.project_id || network.tenant_id;

        return (
            Boolean(projectId) &&
            ownerId === projectId &&
            network.name.startsWith("nhom10_") &&
            network.name !== "nhom10_net"
        );
    };

    const isTestSubnet = (subnet) => {
        const network = networks.find(
            (n) => n.id === subnet.network_id
        );

        return Boolean(network && isTestNetwork(network));
    };


    // Xoa Subnet
    const handleDeleteSubnet = async (subnet) => {
        if (!isTestSubnet(subnet)) return;

        if (!window.confirm(`Ban co chac muon xoa ${subnet.name}?`)) {
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            await osClient.deleteSubnet(subnet.id);

            const data = await osClient.getSubnets();
            setSubnets(data);

            setMessage(`Da xoa Subnet ${subnet.name} thanh cong!`);
        } catch (error) {
            setMessage(
                `Loi xoa Subnet: ${error.response?.status || error.message}`
            );
        } finally {
            setLoading(false);
        }
    };

    // Xoa Network
    const handleDeleteNetwork = async (network) => {
        if (!isTestNetwork(network)) return;

        if (!window.confirm(`Ban co chac muon xoa ${network.name}?`)) {
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            const currentSubnets = await osClient.getSubnets();

            if (currentSubnets.some(
                (subnet) => subnet.network_id === network.id
            )) {
                setSubnets(currentSubnets);
                setMessage("Hay xoa Subnet thuoc Network nay truoc.");
                return;
            }

            await osClient.deleteNetwork(network.id);

            const data = await osClient.getNetworks();
            setNetworks(data);

            setMessage(`Da xoa Network ${network.name} thanh cong!`);
        } catch (error) {
            setMessage(
                `Loi xoa Network: ${error.response?.status || error.message}`
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: 30, maxWidth: 950, margin: "auto" }}>
            <h2>Network Management</h2>

            <h3>Tao Network moi</h3>

            <form onSubmit={handleCreateNetwork}>
                <input
                    type="text"
                    placeholder="Nhap ten Network"
                    value={newNetworkName}
                    onChange={(e) => setNewNetworkName(e.target.value)}
                    required
                    style={{
                        padding: "10px",
                        width: "300px",
                        marginRight: "10px"
                    }}
                />

                <button type="submit" disabled={loading}>
                    {loading ? "Dang xu ly..." : "Tao Network"}
                </button>
            </form>

            <h3>Tao Subnet moi</h3>

            <form onSubmit={handleCreateSubnet}>
                <div style={{ marginBottom: 10 }}>
                    <label>Chon Network: </label>

                    <select
                        value={selectedNetworkId}
                        onChange={(e) => setSelectedNetworkId(e.target.value)}
                        required
                        style={{ padding: 10, width: 300 }}
                    >
                        <option value="">-- Chon Network --</option>

                        {networks
                            .filter(
                                (network) =>
                                    network["router:external"] !== true &&
                                    network.name !== "Public_Net"
                            )
                            .map((network) => (
                                <option key={network.id} value={network.id}>
                                    {network.name}
                                </option>
                            ))}
                    </select>
                </div>

                <div style={{ marginBottom: 10 }}>
                    <input
                        type="text"
                        placeholder="Ten Subnet"
                        value={newSubnetName}
                        onChange={(e) => setNewSubnetName(e.target.value)}
                        required
                        style={{ padding: 10, width: 300 }}
                    />
                </div>

                <div style={{ marginBottom: 10 }}>
                    <input
                        type="text"
                        placeholder="CIDR"
                        value={newSubnetCidr}
                        onChange={(e) => setNewSubnetCidr(e.target.value)}
                        required
                        style={{ padding: 10, width: 300 }}
                    />
                </div>

                <button type="submit" disabled={loading}>
                    {loading ? "Dang tao..." : "Tao Subnet"}
                </button>
            </form>

            <br />

            <br />

            <button onClick={loadNetworks} disabled={loading}>
                Liet ke Network
            </button>

            <button
                onClick={loadSubnets}
                disabled={loading}
                style={{ marginLeft: 10 }}
            >
                Liet ke Subnet
            </button>

            <p>{message}</p>

            {networks.length > 0 && (
                <div>
                    <h3>Danh sach Network</h3>

                    <table border="1" cellPadding="10" width="100%">
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Ten Network</th>
                                <th>ID</th>
                                <th>Trang thai</th>
                                <th>Thao tac</th>
                            </tr>
                        </thead>

                        <tbody>
                            {networks.map((network, index) => (
                                <tr key={network.id}>
                                    <td>{index + 1}</td>
                                    <td>{network.name}</td>
                                    <td>{network.id}</td>
                                    <td>{network.status}</td>

                                    <td>
                                        {isTestNetwork(network) && (
                                            <button
                                                onClick={() => handleDeleteNetwork(network)}
                                                disabled={loading}
                                                style={{ color: "red" }}
                                            >
                                                Xoa
                                            </button>
                                        )}
                                    </td>

                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {subnets.length > 0 && (
                <div>
                    <h3>Danh sach Subnet</h3>

                    <table border="1" cellPadding="10" width="100%">
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Ten Subnet</th>
                                <th>Network ID</th>
                                <th>CIDR</th>
                                <th>Gateway</th>
                                <th>Thao tac</th>
                            </tr>
                        </thead>

                        <tbody>
                            {subnets.map((subnet, index) => (
                                <tr key={subnet.id}>
                                    <td>{index + 1}</td>
                                    <td>{subnet.name}</td>
                                    <td>{subnet.network_id}</td>
                                    <td>{subnet.cidr}</td>
                                    <td>{subnet.gateway_ip || "Khong co"}</td>

                                    <td>
                                        {isTestSubnet(subnet) && (
                                            <button
                                                onClick={() => handleDeleteSubnet(subnet)}
                                                disabled={loading}
                                                style={{ color: "red" }}
                                            >
                                                Xoa
                                            </button>
                                        )}
                                    </td>

                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default NetworkTab;
