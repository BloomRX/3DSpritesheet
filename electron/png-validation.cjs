const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < CRC_TABLE.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  CRC_TABLE[index] = value >>> 0;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function validatePngBuffer(buffer, { requireRgba8 = false } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 57 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('O output não tem uma estrutura PNG completa.');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = null;
  let colorType = null;
  let foundHeader = false;
  let foundImageData = false;
  let foundEnd = false;

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const chunkEnd = offset + 12 + length;
    if (chunkEnd > buffer.length) throw new Error('O PNG está truncado em um chunk.');
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const crcOffset = dataStart + length;
    const expectedCrc = buffer.readUInt32BE(crcOffset);
    const actualCrc = crc32(buffer.subarray(offset + 4, crcOffset));
    if (expectedCrc !== actualCrc) throw new Error(`O PNG tem checksum CRC inválido no chunk ${type}.`);

    if (!foundHeader) {
      if (type !== 'IHDR' || length !== 13) throw new Error('O PNG não começa com um cabeçalho IHDR válido.');
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      bitDepth = buffer[dataStart + 8];
      colorType = buffer[dataStart + 9];
      const validDepths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
      if (width < 1 || height < 1 || !validDepths[colorType]?.includes(bitDepth)) throw new Error('O PNG declara dimensões, profundidade ou tipo de cor inválidos.');
      if (buffer[dataStart + 10] !== 0 || buffer[dataStart + 11] !== 0 || buffer[dataStart + 12] > 1) {
        throw new Error('O PNG declara métodos de compressão, filtro ou entrelaçamento inválidos.');
      }
      foundHeader = true;
    } else if (type === 'IHDR') {
      throw new Error('O PNG contém mais de um cabeçalho IHDR.');
    }

    if (type === 'IDAT') foundImageData = true;
    if (type === 'IEND') {
      if (length !== 0 || !foundImageData) throw new Error('O PNG não contém dados de imagem e encerramento válidos.');
      foundEnd = true;
      offset = chunkEnd;
      break;
    }
    offset = chunkEnd;
  }

  if (!foundHeader || !foundImageData || !foundEnd || offset !== buffer.length) throw new Error('O PNG não contém uma sequência completa de chunks até IEND.');
  if (requireRgba8 && (bitDepth !== 8 || colorType !== 6)) throw new Error('A spritesheet precisa ser PNG RGBA de 8 bits com canal alpha.');
  return { width, height, bitDepth, colorType, hasAlpha: colorType === 4 || colorType === 6 };
}

module.exports = { validatePngBuffer };
