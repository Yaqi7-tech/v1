const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3000;

// 启用CORS
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'file://', 'null'],
    credentials: true
}));

// 代理Dify API请求
app.use('/api', createProxyMiddleware({
    target: 'http://dify.ai-role.cn',
    changeOrigin: true,
    secure: false,
    pathRewrite: {
        '^/api': '/v1'
    },
    onProxyReq: (proxyReq, req, res) => {
        console.log('代理请求:', req.method, req.url);
        console.log('Authorization头:', req.headers.authorization);

        // 确保Authorization头被正确传递
        if (req.headers.authorization) {
            proxyReq.setHeader('Authorization', req.headers.authorization);
        }

        // 设置其他必要的头
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Accept', 'application/json');
    },
    onProxyRes: (proxyRes, req, res) => {
        console.log('代理响应状态:', proxyRes.statusCode, req.url);
        console.log('响应头:', proxyRes.headers);
    },
    onError: (err, req, res) => {
        console.error('代理错误:', err);
        res.status(500).json({
            error: '代理服务器错误',
            message: err.message,
            url: req.url
        });
    }
}));

// 静态文件服务
app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`代理服务器运行在 http://localhost:${PORT}`);
    console.log('请访问 http://localhost:3000/index.html');
});