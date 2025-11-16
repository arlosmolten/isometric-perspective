import assert from 'assert';
import { isoToCartesian, cartesianToIso, calculateIsometricVerticalDistance } from '../scripts/utils.js';
import { mergeRectangles } from '../scripts/utils.js';

// Test isoToCartesian and cartesianToIso inverse property
const p = { x: 10, y: 5 };
const iso = cartesianToIso(p.x, p.y);
const cart = isoToCartesian(iso.x, iso.y);

console.log('Original cart coords:', p);
console.log('Converted to iso:', iso);
console.log('Back to cart:', cart);

assert(Math.abs(cart.x - p.x) < 1e-9, 'cart.x should round-trip');
assert(Math.abs(cart.y - p.y) < 1e-9, 'cart.y should round-trip');

// Test calculateIsometricVerticalDistance (sanity check)
const v = calculateIsometricVerticalDistance(10, 20);
assert(Math.abs(v - Math.sqrt(2) * Math.min(10, 20)) < 1e-9, 'height calculation should be sqrt(2) * min(width,height)');

console.log('All tests passed.');

// Tests for mergeRectangles
(() => {
	const input = [
		{ x: 0, y: 0, width: 10, height: 10 },
		{ x: 5, y: 5, width: 12, height: 12 },
		{ x: 25, y: 25, width: 5, height: 5 }
	];
	const result = mergeRectangles(input);
	// Should merge the first two rectangles but keep the third separate
	assert(result.length === 2, 'Should return two merged rectangles');
	const merged = result.find(r => r.x <= 0 && r.y <= 0);
	assert(merged.width >= 15 && merged.height >= 15, 'Merged rect should encompass the first two');
	console.log('mergeRectangles test passed.');
})();
