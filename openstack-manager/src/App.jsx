
import AuthTab from "./components/AuthTab";
import NetworkTab from "./components/NetworkTab";
import RouterTab from "./components/RouterTab";
import NetworkConfigTab from "./components/NetworkConfigTab";
import InstanceTab from "./components/InstanceTab";

function App() {
    return (
        <div>
            <header style={{ textAlign: "center", padding: 20 }}>
                <h1>OpenStack Manager - Nhom 10</h1>
            </header>

            <main>
                <AuthTab />

                <hr />

                <NetworkTab />

                <hr />

                <RouterTab />

                <hr />

                <NetworkConfigTab />

                <hr />

                <InstanceTab />

            </main>
        </div>
    );
}

export default App;
