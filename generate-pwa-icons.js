const fs = require('fs');
const path = require('path');

// Canvas 라이브러리가 없으므로 SVG로 아이콘 생성
function generateSVGIcon(size) {
    const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
        </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${size * 0.1}" fill="url(#grad1)"/>
    <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.4}" 
          fill="white" text-anchor="middle" dominant-baseline="central">📋</text>
</svg>`;
    return svg;
}

// icons 디렉토리 생성
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir);
}

// 아이콘 크기 배열
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

console.log('🎨 PWA 아이콘 생성 중...');

// SVG 아이콘들 생성
sizes.forEach(size => {
    const svg = generateSVGIcon(size);
    const filename = `icon-${size}x${size}.svg`;
    const filepath = path.join(iconsDir, filename);
    
    fs.writeFileSync(filepath, svg);
    console.log(`✅ ${filename} 생성 완료`);
});

// PNG 변환을 위한 HTML 생성 (브라우저에서 SVG를 PNG로 변환)
const converterHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>SVG to PNG 변환</title>
</head>
<body>
    <h1>SVG를 PNG로 변환</h1>
    <div id="canvases"></div>
    <button onclick="convertAll()">모든 SVG를 PNG로 변환 및 다운로드</button>
    
    <script>
        const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
        
        function convertAll() {
            sizes.forEach((size, index) => {
                setTimeout(() => convertSVGtoPNG(size), index * 200);
            });
        }
        
        function convertSVGtoPNG(size) {
            const svg = \`<svg width="\${size}" height="\${size}" viewBox="0 0 \${size} \${size}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <rect width="\${size}" height="\${size}" rx="\${size * 0.1}" fill="url(#grad1)"/>
                <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="\${size * 0.4}" 
                      fill="white" text-anchor="middle" dominant-baseline="central">📋</text>
            </svg>\`;
            
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            
            const img = new Image();
            const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            
            img.onload = function() {
                ctx.drawImage(img, 0, 0);
                canvas.toBlob(function(blob) {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = \`icon-\${size}x\${size}.png\`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                }, 'image/png');
                URL.revokeObjectURL(url);
            };
            
            img.src = url;
        }
    </script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'svg-to-png.html'), converterHTML);

console.log('🎉 아이콘 생성 완료!');
console.log('📁 SVG 파일들이 icons/ 폴더에 생성되었습니다.');
console.log('🌐 http://localhost:3000/svg-to-png.html 에서 PNG로 변환할 수 있습니다.');