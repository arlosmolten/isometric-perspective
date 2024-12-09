import { MODULE_ID, DEBUG_PRINT, WORLD_ISO_FLAG } from './main.js';

// Define all projection types
export const PROJECTION_TYPES = {
  'True Isometric': {
    rotation:  -30,
    skewX:      30,
    skewY:       0,
    HudAngle:   30,
    reverseRotation: 45,
    reverseSkewX:     0,
    reverseSkewY:     0,
    ratio:       Math.sqrt(3)
  },
  'Dimetric (2:1)': {
    rotation:    -45,
    skewX:    18.435,
    skewY:    18.435,
    HudAngle:  26.57,
    reverseRotation: 45,
    reverseSkewX:     0,
    reverseSkewY:     0,
    ratio:            2
  },
  'Overhead (√2:1)': {
    rotation:     -45,
    skewX:   9.735607,
    skewY:   9.735607,
    HudAngle:   35.26,
    reverseRotation: 45,
    reverseSkewX:     0,
    reverseSkewY:     0,
    ratio:  1.414213389
  },
  'Projection (3:2)': {
    rotation:    -45,
    skewX:   11.3101,
    skewY:   11.3101,
    HudAngle:  33.69,
    reverseRotation: 45,
    reverseSkewX:     0,
    reverseSkewY:     0,
    ratio:          1.5
  },
  'Game: Diablo 1': {
    rotation: -30,
    skewX:     34,
    skewY:      4,
    HudAngle:  26,
    reverseRotation: 45,
    reverseSkewX:     0,
    reverseSkewY:     0,
    ratio:       2.0503038415792987
  },
  'Game: Planescape Torment': {
    rotation: -35,
    skewX:     20,
    skewY:      0,
    HudAngle:  35,
    reverseRotation: 45,
    reverseSkewX:     0,
    reverseSkewY:     0,
    ratio:       1.428148006742114
  }/*,
  'Fallout Style': {
    rotation: -14,
    skewX:     39,
    skewY:      0,
    HudAngle:  14,
    reverseRotation: 45,
    reverseSkewX:     0,
    reverseSkewY:     0,
    ratio:       Math.sqrt(3)
  },
  'Earthbound / Paperboy Style': {
    rotation:   0,
    skewX:    -49,
    skewY:      0,
    HudAngle:   0,
    reverseRotation: 45,
    reverseSkewX:     0,
    reverseSkewY:     0,
    ratio:       0.373884679484805
  }*/
};

// Default projection type
export const DEFAULT_PROJECTION = 'True Isometric';

// Current isometric constants
export let ISOMETRIC_CONST = { ...PROJECTION_TYPES[DEFAULT_PROJECTION] };

// Function to convert degrees to radians for all angle properties
function convertToRadians(projectionData) {
  const angleProps = ['rotation', 'skewX', 'skewY', 'reverseRotation', 'reverseSkewX', 'reverseSkewY'];
  const result = { ...projectionData };
  
  angleProps.forEach(prop => {
    result[prop] = result[prop] * Math.PI / 180;
  });
  
  return result;
}

export function updateIsometricConstants(projectionType) {
  const projection = PROJECTION_TYPES[projectionType] || PROJECTION_TYPES[DEFAULT_PROJECTION];
  ISOMETRIC_CONST = convertToRadians(projection);
}


/*
// values in degrees
export let ISOMETRIC_CONST = {
  rotation: -30 * Math.PI / 180,
  skewX:     30 * Math.PI / 180,
  skewY:      0 * Math.PI / 180,
  reverseRotation: 45 * Math.PI / 180, //rotation + 45
  reverseSkewX:     0 * Math.PI / 180,
  reverseSkewY:     0 * Math.PI / 180,
  ratio:         Math.sqrt(3)
}

export function updateIsometricConstants(option) {
  switch (option) {
    case 'True Isometric':
      ISOMETRIC_CONST = {
        rotation: -30.0,
        skewX:     30.0,
        skewY:      0.0,
        reverseRotation: 45,
        reverseSkewX:     0,
        reverseSkewY:     0,
        ratio:       Math.sqrt(3)
      };
      break;
    case 'Diablo 1':
      ISOMETRIC_CONST = {//                ✓
        rotation:  -30, // -45  -30  -60  -15  -15
        skewX:      34, //  19   34    4   49   49
        skewY:       4, //  19    4   34  -11  -12.13010 (ratio 2.000000102719437 angle 0.57) 
        reverseRotation: 45, // 2.0503038415792987
        reverseSkewX:     0,
        reverseSkewY:     0,
        ratio:       2.0503038415792987
      };
      break;
    case 'Planescape Torment Style':
      ISOMETRIC_CONST = {
        rotation: -35,
        skewX:     20,
        skewY:      0,
        reverseRotation: 45,
        reverseSkewX:     0,
        reverseSkewY:     0,
        ratio:       1.428148006742114
      };
      break;
    case 'Fallout Style':
      ISOMETRIC_CONST = {
        rotation:  -15,
        skewX:      38,
        skewY:       1,
        reverseRotation: 45,
        reverseSkewX:     0,
        reverseSkewY:     0,
        ratio:       Math.sqrt(3)
      };
      break;
    case 'Earthbound / Paperboy Style':
      ISOMETRIC_CONST = {
        rotation:   0,
        skewX:    -49,
        skewY:      0,
        reverseRotation: 45,
        reverseSkewX:     0,
        reverseSkewY:     0,
        ratio:       0.373884679484805
      };
      break;
  }

  //convert to rad
  ISOMETRIC_CONST.rotation *= Math.PI / 180;
  ISOMETRIC_CONST.skewX *= Math.PI / 180;
  ISOMETRIC_CONST.skewY *= Math.PI / 180;
  ISOMETRIC_CONST.reverseRotation *= Math.PI / 180;
  ISOMETRIC_CONST.reverseSkewX *= Math.PI / 180;
  ISOMETRIC_CONST.reverseSkewY *= Math.PI / 180;

}
*/