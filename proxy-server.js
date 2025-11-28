const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const fetch = require('node-fetch');

// 检测是否在Vercel环境中
const isVercel = process.env.VERCEL;

if (!isVercel) {
    // 本地开发环境
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
} else {
    // Vercel无服务器函数
    module.exports = async (req, res) => {
        // 启用CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        // 处理API请求
        if (req.url.startsWith('/api/')) {
            try {
                // 构建正确的目标URL
                const pathPart = req.url.replace('/api', '');
                const targetUrl = `http://dify.ai-role.cn/v1${pathPart}`;

                console.log('Vercel代理请求:', req.method, targetUrl);
                console.log('请求头:', req.headers);
                console.log('请求体:', req.body);

                // 准备请求头，移除可能导致冲突的头
                const headers = {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': req.headers.authorization || ''
                };

                // 只添加必要的自定义头
                if (req.headers['user-agent']) {
                    headers['User-Agent'] = req.headers['user-agent'];
                }

                // 准备请求体
                let body;
                if (req.method !== 'GET' && req.method !== 'HEAD') {
                    // 如果req.body已经是字符串，直接使用；否则序列化
                    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
                    console.log('最终请求体:', body);
                }

                const response = await fetch(targetUrl, {
                    method: req.method,
                    headers: headers,
                    body: body
                });

                const contentType = response.headers.get('content-type');
                let data;

                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = await response.text();
                }

                console.log('Vercel代理响应状态:', response.status);
                console.log('Vercel代理响应数据:', data);

                // 设置响应头
                res.setHeader('Content-Type', contentType || 'application/json');
                res.status(response.status);
                res.send(data);
            } catch (error) {
                console.error('Vercel代理错误:', error);
                res.status(500).json({
                    error: '代理服务器错误',
                    message: error.message,
                    url: req.url
                });
            }
        } else {
            // 非API请求返回404，静态文件会由Vercel自动处理
            res.status(404).json({ error: 'Not found' });
        }
    };
}
            res.status(404).json({ error: 'Not found' });
        }
    };
}
