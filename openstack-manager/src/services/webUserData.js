function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

export function encodeUserData(text) {
    const encoded = btoa(Array.from(new TextEncoder().encode(text), (byte) => String.fromCharCode(byte)).join(""));
    if (encoded.length > 65535) throw new Error("User Data quá lớn (giới hạn 65535 byte sau khi mã hóa Base64).");
    return encoded;
}

export function buildWebUserData(groupInfo) {
    if (!groupInfo?.trim()) throw new Error("Vui lòng nhập thông tin nhóm để hiển thị trên website.");
    if (groupInfo.length > 8000) throw new Error("Thông tin nhóm tối đa 8000 ký tự.");
    const html = `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>NT533 Lab 02 – Web Server</title>
<style>
body{font-family:Arial,sans-serif;font-size:16px;max-width:800px;margin:40px auto;padding:20px;line-height:1.6}
pre,code{font:inherit}
pre{white-space:pre-wrap;overflow-wrap:anywhere}
code{overflow-wrap:anywhere}
</style></head>
<body><h1>Thông tin nhóm</h1><pre>${escapeHtml(groupInfo.trim())}</pre>
<p>IP máy ảo: <code><!--# echo var="server_addr" encoding="entity" --></code></p>
<p>Floating IP: <code><!--# echo var="host" encoding="entity" --></code></p>
</body></html>
`;
    // JSON là cú pháp YAML hợp lệ, tránh ghép thông tin người dùng vào lệnh shell.
    return "#cloud-config\n" + JSON.stringify({
        package_update: true,
        packages: ["nginx"],
        write_files: [
            { path: "/var/www/nt533/index.html", permissions: "0644", content: html },
            { path: "/etc/nginx/sites-available/nt533", permissions: "0644", content: `server {
    listen 80 default_server;
    server_name _;
    root /var/www/nt533;
    index index.html;
    charset utf-8;
    location / {
        ssi on;
        add_header Cache-Control "no-store";
        try_files $uri $uri/ =404;
    }
}
` }
        ],
        runcmd: [["sh", "-ec", "ln -sfn /etc/nginx/sites-available/nt533 /etc/nginx/sites-enabled/default\nnginx -t\nsystemctl enable nginx\nsystemctl restart nginx"]]
    }, null, 2) + "\n";
}
