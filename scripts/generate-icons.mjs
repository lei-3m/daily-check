// 앱 아이콘 생성기. SVG 원본과 PNG를 같은 기하 정의에서 함께 뽑는다.
// 따로 두면 한쪽만 고쳐져 아이콘이 서로 달라진다.
//
//   npm run icons
//
// 외부 의존성 없이 zlib으로 PNG를 직접 쓴다. 도형이 사각형과 선 세 점뿐이라
// 래스터라이저를 들일 이유가 없다.

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public');

// 512 기준 좌표. 다른 크기는 비율로 확대·축소한다.
const CANVAS = 512;
const CORNER_RADIUS = 112;
const BACKGROUND = '#0f172a';
const FOREGROUND = '#ffffff';
const STROKE_WIDTH = 48;
const CHECK_POINTS = [
  [140, 260],
  [220, 340],
  [370, 170],
];

// maskable 아이콘은 런처가 원·둥근사각형 등으로 잘라낸다.
// 배경은 모서리까지 꽉 채우고(둥근 모서리 없음), 그림은 가운데 80% 원 안에 있어야 한다.
// 위 체크는 중심에서 최대 167px(획 포함)이라 안전 반지름 204.8px 안에 들어온다.
const SAFE_ZONE_RATIO = 0.8;

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** 둥근 사각형까지의 부호 있는 거리. 음수면 안쪽. */
function roundedRectDistance(x, y, size, radius) {
  const half = size / 2;
  const dx = Math.abs(x - half) - (half - radius);
  const dy = Math.abs(y - half) - (half - radius);
  const outsideX = Math.max(dx, 0);
  const outsideY = Math.max(dy, 0);
  return Math.hypot(outsideX, outsideY) + Math.min(Math.max(dx, dy), 0) - radius;
}

/** 선분을 두께만큼 부풀린 도형까지의 거리. 둥근 끝과 이음매가 그대로 나온다. */
function segmentDistance(x, y, [ax, ay], [bx, by], radius) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = x - ax;
  const apy = y - ay;
  const lengthSq = abx * abx + aby * aby;
  const t = lengthSq === 0 ? 0 : Math.min(Math.max((apx * abx + apy * aby) / lengthSq, 0), 1);
  return Math.hypot(apx - abx * t, apy - aby * t) - radius;
}

function checkDistance(x, y, radius) {
  let distance = Infinity;
  for (let i = 0; i < CHECK_POINTS.length - 1; i += 1) {
    distance = Math.min(distance, segmentDistance(x, y, CHECK_POINTS[i], CHECK_POINTS[i + 1], radius));
  }
  return distance;
}

const SUBSAMPLES = 4;

/** 도형 경계에서 계단이 보이지 않도록 픽셀당 4x4로 샘플링해 덮인 비율을 구한다. */
function coverage(px, py, scale, isInside) {
  let hits = 0;
  for (let sy = 0; sy < SUBSAMPLES; sy += 1) {
    for (let sx = 0; sx < SUBSAMPLES; sx += 1) {
      const x = (px + (sx + 0.5) / SUBSAMPLES) / scale;
      const y = (py + (sy + 0.5) / SUBSAMPLES) / scale;
      if (isInside(x, y)) hits += 1;
    }
  }
  return hits / (SUBSAMPLES * SUBSAMPLES);
}

function renderRgba(size, { maskable }) {
  const scale = size / CANVAS;
  const strokeRadius = STROKE_WIDTH / 2;
  const background = hexToRgb(BACKGROUND);
  const foreground = hexToRgb(FOREGROUND);
  const pixels = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const backgroundAlpha = maskable
        ? 1
        : coverage(px, py, scale, (x, y) => roundedRectDistance(x, y, CANVAS, CORNER_RADIUS) <= 0);
      const checkAlpha = coverage(px, py, scale, (x, y) => checkDistance(x, y, strokeRadius) <= 0);

      const alpha = Math.max(backgroundAlpha, checkAlpha);
      const offset = (py * size + px) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        // 흰 체크를 배경 위에 올린다. 알파를 미리 곱하지 않은 색을 쓴다.
        const mixed =
          alpha === 0
            ? 0
            : (background[channel] * (backgroundAlpha - Math.min(backgroundAlpha, checkAlpha)) +
                foreground[channel] * checkAlpha) /
              alpha;
        pixels[offset + channel] = Math.round(Math.min(Math.max(mixed, 0), 255));
      }
      pixels[offset + 3] = Math.round(alpha * 255);
    }
  }

  return pixels;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // color type: RGBA
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  // 스캔라인마다 필터 바이트 0을 붙인다.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function buildSvg({ maskable }) {
  const path = CHECK_POINTS.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
  const background = maskable
    ? `<rect width="${CANVAS}" height="${CANVAS}" fill="${BACKGROUND}"/>`
    : `<rect width="${CANVAS}" height="${CANVAS}" rx="${CORNER_RADIUS}" fill="${BACKGROUND}"/>`;
  const note = maskable
    ? `\n  <!-- maskable: 런처가 잘라내므로 배경은 꽉 채우고 체크는 가운데 ${SAFE_ZONE_RATIO * 100}% 원 안에 둔다 -->`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">${note}
  ${background}
  <path d="${path}" fill="none" stroke="${FOREGROUND}" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
}

function write(name, contents) {
  const target = resolve(OUT_DIR, name);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
  console.log(`${name} (${contents.length} bytes)`);
}

write('icon.svg', buildSvg({ maskable: false }));
write('icon-maskable.svg', buildSvg({ maskable: true }));

for (const size of [192, 512]) {
  write(`icon-${size}.png`, encodePng(size, renderRgba(size, { maskable: false })));
  write(`icon-maskable-${size}.png`, encodePng(size, renderRgba(size, { maskable: true })));
}
