## About v13 Release

This current version (v13) was made possible thanks to the significant contributions of:

- **@warpspeednyancatpatreon** – key updates to compatibility and core isometric features
- **@JoshBrodieNZ** – major bug fixes and architectural improvements

Thank you to all contributors who helped make this release possible!

# Isometric Perspective

![Isometric Map Example](https://raw.githubusercontent.com/arlosmolten/isometric-perspective/refs/heads/main/files/banner2.jpg)

![Static Badge - Foundry VTT Version](https://img.shields.io/badge/Foundry%20VTT-v11+-blue)
![Latest Release version](https://img.shields.io/github/v/release/arlosmolten/isometric-perspective?color=green)
![Downloads Latest](https://img.shields.io/github/downloads/arlosmolten/isometric-perspective/isometric-perspective.zip?color=yellow)
![Static Badge - License](https://img.shields.io/badge/license%20-%20MIT-yellow)
![Contributors](https://img.shields.io/badge/Contributors-@warpspeednyancatpatreon%20|%20@JoshBrodieNZ%20|%20ArlosMolten-orange)


[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H2H1160UID)
[![Discord](https://raw.githubusercontent.com/arlosmolten/isometric-perspective/refs/heads/main/files/discordsm.png)](https://discord.gg/64p6ZqQBNX)

This module changes the map, tiles and token artwork/sprite for use with maps and tokens drawn using an isometric perspective. 

## Features

Here are some of the features the module offers. You can also see how all the features of this module work with some videos on my [wiki](https://github.com/arlosmolten/isometric-perspective/wiki/1.-Core-Features).

- **Dual Canvas Perspectives:** Use native isometric maps or transform top-down maps into an isometric perspective. This allows you to apply an isometric view to virtually any 2D map.
- **Multiple Isometric Projections:** Choose from several isometric projection types with different aspect ratios, including true isometric (√3:1), dimetric (2:1), overhead (√2:1), and other projections inspired by classic games. You can also create and add your own custom perspective using the tool available [here](https://arlosmolten.github.io/isometric-perspective/).
- **Token Sprite Adjustments:** Fine-tune token sprite position and scale. Token artwork can be perfectly centered even for asymmetrical images. Increasing token size automatically scales the sprite, but this behavior can be disabled to support unconventional token sizes (for example, a 2×1 tank).
- **Tile Sprite Adjustments:** Adjust tile sprite position and scale with ease, making it simple to copy and paste multiple tiles. An easy-to-use Flip Tile option is also available.
- **Token Height Visual Cues:** When a token has elevation, its sprite visually reflects height using dynamic shadows and vertical guide lines for improved depth perception.
- **Dynamic Tile:** Link tiles to walls so they automatically become hidden based on token position, creating an experience similar to classic isometric games.
- **Auto Sorting Token:** Tokens are automatically layered based on their position on the canvas, ensuring that distant tokens appear behind closer ones.

## Configuration Screens
> *Outdated v12 images*

![](https://raw.githubusercontent.com/arlosmolten/isometric-perspective/refs/heads/main/files/configuration-screens.jpg)


## Images
*Token and map art provided by [Epic Isometric](https://www.patreon.com/c/epicisometric/posts) and [The Dungeon Sketcher.](https://www.patreon.com/TheDungeonSketcher)*

![](https://raw.githubusercontent.com/arlosmolten/isometric-perspective/refs/heads/main/files/showcase-1.jpg)
![](https://raw.githubusercontent.com/arlosmolten/isometric-perspective/refs/heads/main/files/showcase-2.jpg)
![](https://raw.githubusercontent.com/arlosmolten/isometric-perspective/refs/heads/main/files/dynamictile.jpg)
*Dynamic Tile previews.*
![](https://raw.githubusercontent.com/arlosmolten/isometric-perspective/refs/heads/main/files/elevation.jpg)
*Elevation previews.*

## Compatibility *(outdated for v13)*
The core functionality of this module applies a transformation to the canvas (rotation and skew) to achieve an isometric perspective, while reversing that transformation on backgrounds, tokens, and tiles. This approach preserves compatibility with most Foundry core features and with modules that do not directly manipulate these systems. Native features such as templates, drawings, and lighting are expected to work as intended

These are the modules I've tested and their status:

- **Working**  
Drag Upload  
Elevation Ruler  
FXMaster  
Levels  
Sequencer  
Tactical Grid  
Tile Sort  
Token Ease  
Token Movement 8bit Style  
Wall Height  

- **Partially Working**  
DFred Droppables _(tokens are dropped far from the point where the mouse is pointing. Just zoom out to find where they are)_  
Drag Ruler _(sometimes the values ​​do not appear, but this is a problem with the drag ruler and not this module)_  
Token Magic FX _(some area effects, like sphere effects, are deformed)_  
Rideable _(if both mount and rider tokens have the same size, isn't possible to select the mount token)_

- **Not working**  
Image Hover _(render the art, but it moves with the pan of the canvas. You can only see it if you use hotkeys, and will not show the entire art)_  
LockerView _(needs a 330° rotation to make a working isometric rotation)_

## Known Bugs *(outdated for v13)*

- **Scene Grid Configuration**: The canvas background configuration in Scene Settings > Grid > Ruler Tool ( <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/37eff7fa00de26db41183a3ad8ed0e9119fbc44b/svgs/solid/ruler-combined.svg" width="15" height="15"></i> ) does not work.
  - **Workaround**: The art scale function has been recreated in the Isometric tab, and you can set the offset in the Grid tab. For align the grid, you really should use the module [Grid Scaler](https://github.com/atomdmac/scaleGrid/) for that.

- **TokenHud and TileHud Position**: The position of the TileHud (menu on right-clicking a tile) is aligned with the left vertex, but sometimes will be far away from the token/tile.

  - **Workaround**: In most cases, running the macro `canvas.draw()` is enough to fix.

## To-Do List *(outdated for v13)*

- [ ] Code to handle tiles and walls.
- [ ] Code to handle occlusion of tiles and tokens.
- [?] Different token art for isometric and top-down views.
- [x] Code to handle non symmetrical token sizes.
- [x] Translation to other languages.
- [x] Add new perspectives.
- [x] Add custom perspectives.
- [x] Check compatibility with other canvas related modules.
- [x] Bugfix: Change tokens properties (vision) change token position.
- [x] Using core foundry controls for token scale and anchor. *(Scrapped idea).*

## Contribution

Contributions are welcome! If you want to improve this module, feel free to open an issue or submit a pull request.

#### v13 Main Contributors
- **@warpspeednyancatpatreon** – https://github.com/warpspeednyancatpatreon  
- **@JoshBrodieNZ** – https://github.com/Ludibrium-VTT

## License

This project is under the MIT license. See the [LICENSE](LICENSE) file for more details.