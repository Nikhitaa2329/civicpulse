const sharp = require('sharp');

// Difference hash (dHash) with center-cropping.
//
// Why difference hash instead of average hash: average hashing compares
// each pixel to the image's overall brightness average, which mostly
// captures broad lighting/scene composition. Difference hashing instead
// compares each pixel to its immediate neighbour, capturing structural
// EDGES and GRADIENTS — a much closer proxy for "did the physical surface
// here actually change" (e.g. a jagged pothole edge becoming smooth filled
// asphalt) than overall brightness ever was.
//
// Why center-crop first: complaint photos are typically framed with the
// reported issue roughly centered. Cropping to the center 60% before
// hashing de-emphasizes background elements (sky, distant buildings,
// unrelated road) that don't change when the actual problem is fixed,
// and focuses the comparison on the area most likely to contain it.
const generateHash = async (imageBuffer) => {
  const metadata = await sharp(imageBuffer).metadata();

  const cropWidth = Math.floor(metadata.width * 0.6);
  const cropHeight = Math.floor(metadata.height * 0.6);
  const left = Math.floor((metadata.width - cropWidth) / 2);
  const top = Math.floor((metadata.height - cropHeight) / 2);

  // 9x8 instead of 8x8 — we need one extra column so every pixel
  // in the 8-wide grid has a neighbour to its right to compare against
  const { data } = await sharp(imageBuffer)
    .extract({ left, top, width: cropWidth, height: cropHeight }) // center crop
    .resize(9, 8, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = Array.from(data);
  let hash = '';

  // For each of the 8 rows, compare each pixel to the one immediately
  // to its right, recording '1' if it's brighter, '0' if darker/equal
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const current = row * 9 + col;
      const next = row * 9 + col + 1;
      hash += pixels[current] > pixels[next] ? '1' : '0';
    }
  }

  return hash; // 64-character binary string
};

// Hamming distance: counts how many of the 64 bit-positions differ
// between two hashes. Small distance = structurally similar images
// (suspicious, if comparing a "before" and "after"). Large distance =
// meaningfully different images (a genuine change likely occurred).
const hammingDistance = (hash1, hash2) => {
  if (hash1.length !== hash2.length) {
    throw new Error('Hashes must be the same length to compare');
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }

  return distance;
};

module.exports = { generateHash, hammingDistance };