
import { useState } from "react";
import { osClient } from "../services/openstackClient";

function RouterTab() {
    const [routers, setRouters] = useState([]);
    const [newRouterName, setNewRouterName] = useState("nhom10_router_ui_test");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    // Liet ke Router
    const loadRouters = async () => {
        setLoading(true);
        setMessage("");

        try {
            const data = await osClient.getRouters();
            setRouters(data);
            setMessage(`Tim thay ${data.length} Router.`);
        } catch (error) {
            setMessage(
                `Loi lay Router: ${error.response?.status || error.message}`
            );
        } finally {
            setLoading(false);
        }
    };

    // Tao Router
    const handleCreateRouter = async (e) => {
        e.preventDefault();

        const name = newRouterName.trim();

        if (!name) {
            setMessage("Vui long nhap ten Router.");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            const existingRouters = await osClient.getRouters();

            if (existingRouters.some((router) => router.name === name)) {
                setRouters(existingRouters);
                setMessage("Router da ton tai. Vui long chon ten khac.");
                return;
            }

            const router = await osClient.createRouter(name);

            const data = await osClient.getRouters();
            setRouters(data);

            setMessage(`Tao Router ${router.name} thanh cong!`);
        } catch (error) {
            setMessage(
                `Loi tao Router: ${error.response?.status || error.message}`
            );
        } finally {
            setLoading(false);
        }
    };

    // Xoa Router thu nghiem
    const handleDeleteRouter = async (router) => {
        if (router.name !== "nhom10_router_ui_test") {
            return;
        }

        const confirmed = window.confirm(
            `Ban co chac muon xoa Router ${router.name}?`
        );

        if (!confirmed) return;

        setLoading(true);
        setMessage("");

        try {
            await osClient.deleteRouter(router.id);

            const data = await osClient.getRouters();
            setRouters(data);

            setMessage(`Da xoa Router ${router.name} thanh cong!`);
        } catch (error) {
            setMessage(
                `Loi xoa Router: ${error.response?.status || error.message}`
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: 30, maxWidth: 950, margin: "auto" }}>
            <h2>Router Management</h2>

            <h3>Tao Router moi</h3>

            <form onSubmit={handleCreateRouter}>
                <input
                    type="text"
                    placeholder="Nhap ten Router"
                    value={newRouterName}
                    onChange={(e) => setNewRouterName(e.target.value)}
                    style={{ padding: 8, width: 300 }}
                />

                <button
                    type="submit"
                    disabled={loading}
                    style={{ marginLeft: 10, padding: 8 }}
                >
                    Tao Router
                </button>
            </form>

            <br />

            <button onClick={loadRouters} disabled={loading}>
                Liet ke Router
            </button>

            <p>{message}</p>

            {routers.length > 0 && (
                <div>
                    <h3>Danh sach Router</h3>

                    <table border="1" cellPadding="10" width="100%">
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Ten Router</th>
                                <th>ID</th>
                                <th>Trang thai</th>
                                <th>Thao tac</th>
                            </tr>
                        </thead>

                        <tbody>
                            {routers.map((router, index) => (
                                <tr key={router.id}>
                                    <td>{index + 1}</td>
                                    <td>{router.name}</td>
                                    <td>{router.id}</td>
                                    <td>{router.status}</td>
                                    <td>
                                        {router.name === "nhom10_router_ui_test" && (
                                            <button
                                                onClick={() => handleDeleteRouter(router)}
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

export default RouterTab;
