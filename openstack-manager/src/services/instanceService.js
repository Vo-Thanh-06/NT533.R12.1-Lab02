import axios from "axios";
import { osClient } from "./openstackClient.js";
import { encodeUserData } from "./webUserData.js";

export async function getInstances() {
    const response = await axios.get(
        `${osClient.computeUrl}/servers/detail`,
        osClient.getAuthHeaders()
    );
    return response.data.servers || [];
}

export async function createInstance({ name, imageId, flavorId, networkId, volumeSize, userData, securityGroupId }) {
    const cleanName = name?.trim();
    const size = Number(volumeSize);
    if (!cleanName || cleanName.length > 255) {
        throw new Error("Tên Instance phải có từ 1 đến 255 ký tự.");
    }
    if (!imageId || !flavorId || !networkId) {
        throw new Error("Vui lòng chọn Image, Flavor và Network.");
    }
    if (!Number.isSafeInteger(size) || size < 1) {
        throw new Error("Dung lượng volume phải là số nguyên dương (GB).");
    }

    // Flavor disk = 0 cần boot từ volume, không boot trực tiếp từ imageRef.
    const response = await axios.post(
        `${osClient.computeUrl}/servers`,
        {
            server: {
                name: cleanName,
                ...(userData ? { user_data: encodeUserData(userData) } : {}),
                ...(securityGroupId ? { security_groups: [{ name: securityGroupId }] } : {}),
                flavorRef: flavorId,
                networks: [{ uuid: networkId }],
                block_device_mapping_v2: [{
                    boot_index: 0,
                    uuid: imageId,
                    source_type: "image",
                    destination_type: "volume",
                    volume_size: size,
                    delete_on_termination: true
                }]
            }
        },
        osClient.getAuthHeaders()
    );

    return { id: response.data.server.id };
}
