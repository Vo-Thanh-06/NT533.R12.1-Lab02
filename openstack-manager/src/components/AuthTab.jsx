
import { useState } from "react";
import { osClient } from "../services/openstackClient";

function AuthTab() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loggedIn, setLoggedIn] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const [flavors, setFlavors] = useState([]);
    const [images, setImages] = useState([]);

    const login = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        try {
            await osClient.authenticate(username, password);
            setLoggedIn(true);
            setPassword("");
            setMessage("Dang nhap OpenStack thanh cong!");
        } catch (error) {
            setLoggedIn(false);
            const status = error.response?.status;
            setMessage(
                status
                    ? `Dang nhap that bai! HTTP ${status}`
                    : "Khong ket noi duoc OpenStack."
            );
        } finally {
            setLoading(false);
        }
    };

    const loadFlavors = async () => {
        setLoading(true);
        setMessage("");

        try {
            const data = await osClient.getFlavors();
            setFlavors(data);
            setMessage(`Tim thay ${data.length} Flavor.`);
        } catch (error) {
            setMessage(`Loi lay Flavor: ${error.response?.status || "Ket noi"}`);
        } finally {
            setLoading(false);
        }
    };

    const loadImages = async () => {
        setLoading(true);
        setMessage("");

        try {
            const data = await osClient.getImages();
            setImages(data);
            setMessage(`Da tai ${data.length} Image.`);
        } catch (error) {
            setMessage(`Loi lay Image: ${error.response?.status || "Ket noi"}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: 30, maxWidth: 950, margin: "auto" }}>
            <h2>OpenStack Authentication</h2>
            <p>Project: NT533.R12.G10</p>

            {!loggedIn ? (
                <form onSubmit={login}>
                    <div style={{ marginBottom: 12 }}>
                        <input
                            type="text"
                            placeholder="Username OpenStack"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoComplete="username"
                            style={{ padding: 10, width: 300 }}
                        />
                    </div>

                    <div style={{ marginBottom: 12 }}>
                        <input
                            type="password"
                            placeholder="Password OpenStack"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            style={{ padding: 10, width: 300 }}
                        />
                    </div>

                    <button type="submit" disabled={loading}>
                        {loading ? "Dang ket noi..." : "Dang nhap"}
                    </button>
                </form>
            ) : (
                <div>
                    <p style={{ color: "green" }}>
                        Da xac thuc voi OpenStack!
                    </p>

                    <button onClick={loadFlavors} disabled={loading}>
                        Liet ke Flavor
                    </button>

                    <button
                        onClick={loadImages}
                        disabled={loading}
                        style={{ marginLeft: 10 }}
                    >
                        Liet ke Image
                    </button>
                </div>
            )}

            <p>{message}</p>

            {flavors.length > 0 && (
                <div>
                    <h3>Danh sach Flavor</h3>
                    <table border="1" cellPadding="10" width="100%">
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>ID</th>
                                <th>Ten Flavor</th>
                            </tr>
                        </thead>
                        <tbody>
                            {flavors.map((flavor, index) => (
                                <tr key={flavor.id}>
                                    <td>{index + 1}</td>
                                    <td>{flavor.id}</td>
                                    <td>{flavor.name}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {images.length > 0 && (
                <div>
                    <h3>Danh sach Image</h3>
                    <table border="1" cellPadding="10" width="100%">
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Ten Image</th>
                                <th>Trang thai</th>
                                <th>Dinh dang</th>
                            </tr>
                        </thead>
                        <tbody>
                            {images.map((img, index) => (
                                <tr key={img.id}>
                                    <td>{index + 1}</td>
                                    <td>{img.name}</td>
                                    <td>{img.status}</td>
                                    <td>{img.disk_format}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default AuthTab;
