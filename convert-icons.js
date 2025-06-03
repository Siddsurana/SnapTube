const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];

async function convertSvgToPng(size) {
    const svgPath = path.join(__dirname, 'icons', `icon${size}.svg`);
    const pngPath = path.join(__dirname, 'icons', `icon${size}.png`);

    try {
        // Check if SVG file exists
        if (!fs.existsSync(svgPath)) {
            console.error(`SVG file not found: ${svgPath}`);
            return;
        }

        // Read SVG file
        const svgBuffer = fs.readFileSync(svgPath);

        // Convert to PNG
        await sharp(svgBuffer)
            .resize(size, size)
            .png()
            .toFile(pngPath);

        console.log(`Successfully converted icon${size}.svg to PNG`);
    } catch (error) {
        console.error(`Error converting ${size}px icon:`, error);
    }
}

// Convert all sizes
async function convertAll() {
    for (const size of sizes) {
        await convertSvgToPng(size);
    }
}

convertAll().then(() => {
    console.log('All conversions completed');
}); 