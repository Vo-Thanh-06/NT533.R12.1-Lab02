
import axios from "axios";

class OpenStackClient {
    constructor() {
        this.token = null;

        this.identityUrl = "/api-identity/v3";
        this.computeUrl = "/api-compute/v2.1";
        this.imageUrl = "/api-image/v2";
        this.networkUrl = "/api-network/v2.0";
    }

    // Xac thuc va lay Token
    async authenticate(username, password) {
        const payload = {
            auth: {
                identity: {
                    methods: ["password"],
                    password: {
                        user: {
                            name: username,
                            domain: { name: "Default" },
                            password: password
                        }
                    }
                },
                scope: {
                    project: {
                        name: "NT533.R12.G10",
                        domain: { name: "Default" }
                    }
                }
            }
        };

        const response = await axios.post(
            `${this.identityUrl}/auth/tokens`,
            payload
        );

        const token = response.headers["x-subject-token"];

        if (!token) {
            throw new Error("Khong nhan duoc Token");
        }

        this.token = token;
        return true;
    }

    // Header xac thuc cho cac API
    getAuthHeaders() {
        if (!this.token) {
            throw new Error("Ban chua dang nhap OpenStack");
        }

        return {
            headers: {
                "X-Auth-Token": this.token
            }
        };
    }

    // Liet ke Flavor
    async getFlavors() {
        const response = await axios.get(
            `${this.computeUrl}/flavors`,
            this.getAuthHeaders()
        );

        return response.data.flavors || [];
    }

    // Liet ke Image
    async getImages() {
        const response = await axios.get(
            `${this.imageUrl}/images`,
            this.getAuthHeaders()
        );

        return response.data.images || [];
    }

    // Liet ke danh sach Network
    async getNetworks() {
        const response = await axios.get(
            `${this.networkUrl}/networks`,
            this.getAuthHeaders()
        );

        return response.data.networks || [];
    }

    // Liet ke danh sach Subnet
    async getSubnets() {
        const response = await axios.get(
            `${this.networkUrl}/subnets`,
            this.getAuthHeaders()
        );

        return response.data.subnets || [];
    }

    // Tao Network moi
    async createNetwork(name) {
        const response = await axios.post(
            `${this.networkUrl}/networks`,
            {
                network: {
                    name: name,
                    admin_state_up: true
                }
            },
            this.getAuthHeaders()
        );

        return response.data.network;
    }

    // Tao Subnet moi
    async createSubnet(networkId, name, cidr) {
        const response = await axios.post(
            `${this.networkUrl}/subnets`,
            {
                subnet: {
                    name: name,
                    network_id: networkId,
                    ip_version: 4,
                    cidr: cidr,
                    enable_dhcp: true
                }
            },
            this.getAuthHeaders()
        );

        return response.data.subnet;
    }

    // Xoa Subnet theo ID
    async deleteSubnet(subnetId) {
        const response = await axios.delete(
            `${this.networkUrl}/subnets/${subnetId}`,
            this.getAuthHeaders()
        );

        return response.status === 204;
    }

    // Xoa Network theo ID
    async deleteNetwork(networkId) {
        const response = await axios.delete(
            `${this.networkUrl}/networks/${networkId}`,
            this.getAuthHeaders()
        );

        return response.status === 204;
    }

    async getRouters() {
        const response = await axios.get(
            `${this.networkUrl}/routers`,
            this.getAuthHeaders()
        );

        return response.data.routers || [];
    }

    async createRouter(name) {
        const response = await axios.post(
            `${this.networkUrl}/routers`,
            {
                router: {
                    name: name,
                    admin_state_up: true
                }
            },
            this.getAuthHeaders()
        );

        return response.data.router;
    }

    async deleteRouter(routerId) {
        const response = await axios.delete(
            `${this.networkUrl}/routers/${routerId}`,
            this.getAuthHeaders()
        );

        return response.status === 204;
    }

    async getRouterPorts(routerId) {
        const response = await axios.get(
            `${this.networkUrl}/ports`,
            {
                ...this.getAuthHeaders(),
                params: {
                    device_id: routerId
                }
            }
        );

        return response.data.ports || [];
    }

    // Cau hinh External Gateway cho Router
    async setRouterExternalGateway(routerId, networkId) {
        const response = await axios.put(
            `${this.networkUrl}/routers/${routerId}`,
            {
                router: {
                    external_gateway_info: {
                        network_id: networkId
                    }
                }
            },
            this.getAuthHeaders()
        );

        return response.data.router;
    }

    // Ket noi Router voi Subnet noi bo
    async addRouterInterface(routerId, subnetId) {
        const response = await axios.put(
            `${this.networkUrl}/routers/${routerId}/add_router_interface`,
            {
                subnet_id: subnetId
            },
            this.getAuthHeaders()
        );

        return response.data;
    }

    // Liet ke Security Group va cac Rule
    async getSecurityGroups() {
        const response = await axios.get(
            `${this.networkUrl}/security-groups`,
            this.getAuthHeaders()
        );

        return response.data.security_groups || [];
    }
}

export const osClient = new OpenStackClient();
