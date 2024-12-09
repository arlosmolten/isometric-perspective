# Isometric Perspective

![Isometric Map Example](https://raw.githubusercontent.com/arlosmolten/isometric-perspective/refs/heads/main/files/banner2.jpg)



![Static Badge - Foundry VTT Version](https://img.shields.io/badge/Foundry%20VTT-v12+-blue)
![Latest Release version](https://img.shields.io/github/v/release/arlosmolten/isometric-perspective?color=green)
![Downloads Latest](https://img.shields.io/github/downloads/arlosmolten/isometric-perspective/isometric-perspective.zip?color=yellow)
![Static Badge - License](https://img.shields.io/badge/license%20-%20MIT-yellow)


[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/H2H1160UID)
[![Discord](https://raw.githubusercontent.com/arlosmolten/isometric-perspective/refs/heads/main/files/discordsm.png)](https://discord.gg/64p6ZqQBNX)

This module changes the map, tiles and token artwork/sprite for use with maps and tokens drawn using an isometric perspective.

## Features

Here are some of the features the module offers.

- **Dual Canvas Perspectives:** You can use top-down isometric or native isometric maps. In native isometric mode, you can adjust the scale of the map.
- **Multiple Isometric Perspectives:** You can choose between different types of isometric projections, with different aspect ratios, such as the default true isometric (√3:1), dimetric (2:1), overhead (√2:1) and others specific to well-known old games.
- **Token Sprite Adjustments:** You can fine-tune the position of the token sprite, as well as its scale. Increasing the size of the token automatically increases the size of the sprite. You can adjust the token art sprite to be centered even if the token is assymetrical.
- **Tile Sprite Adjustments:** You can also fine-tune the sprite position and scale, making easy to copy and paste multiple tiles. There's also a easy Flip Tile option.
- **Token Height Visual Cues:** If a token has any elevation, its sprite adjusts to reflect the height, with a round shadow and line sprites being created for clarity.
- **Dynamic Tile:** If you link a tile to a wall, the position of the token can make the tile invisible, and having a isometric game-like experience.
- **Auto Sorting Token:** Tokens are automatically ordered, with tokens that are further away appear behind tokens that are closer, based on canvas position.

## Configuration Screens

![](https://raw.githubusercontent.com/arlosmolten/isometric-perspective/refs/heads/main/files/configuration-screens.jpg)


## Images
*Token and map art provided by [Epic Isometric](https://www.patreon.com/c/epicisometric/posts) and [The Dungeon Sketcher.](https://www.patreon.com/TheDungeonSketcher)*

![](https://raw.githubusercontent.com/arlosmolten/isometric-perspective/refs/heads/main/files/showcase-1.jpg)
![](https://raw.githubusercontent.com/arlosmolten/isometric-perspective/refs/heads/main/files/showcase-2.jpg)
![](https://raw.githubusercontent.com/arlosmolten/isometric-perspective/refs/heads/main/files/dynamictile.jpg)
*Dynamic Tile previews.*
![](https://raw.githubusercontent.com/arlosmolten/isometric-perspective/refs/heads/main/files/elevation.jpg)
*Elevation previews.*

## Compatibility
The basic functionality of this module is just apply a transformation on the canvas (rotate and skew) achieving an isometric perspective while undoing that transformation on the background, tokens, and tiles. This approach ensures compatibility with most Foundry core features and modules that don’t directly interact with these systems. Native functions like templates, drawing, and lighting should work as intended.

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

## Known Bugs

- **Scene Grid Configuration**: The canvas background configuration in Scene Settings > Grid > Ruler Tool ( <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/37eff7fa00de26db41183a3ad8ed0e9119fbc44b/svgs/solid/ruler-combined.svg" width="15" height="15"></i> ) does not work.
  - **Workaround**: The art scale function has been recreated in the Isometric tab, and you can set the offset in the Grid tab. For align the grid, you really should use the module [Grid Scaler](https://github.com/atomdmac/scaleGrid/) for that.

- **TokenHud and TileHud Position**: The position of the TileHud (menu on right-clicking a tile) is aligned with the left vertex, but sometimes will be far away from the token/tile.

  - **Workaround**: In most cases, running the macro `canvas.draw()` is enough to fix.

## To-Do List

- [ ] Add custom perspectives.
- [ ] Code to handle tiles and walls.
- [ ] Code to handle occlusion of tiles and tokens.
- [ ] Different token art for isometric and top-down views.
- [ ] Code to handle non symmetrical token sizes.
- [ ] Translation to other languages.
- [x] Add new perspectives.
- [x] Check compatibility with other canvas related modules.
- [x] Bugfix: Change tokens properties (vision) change token position.
- [x] Using core foundry controls for token scale and anchor. *(Scrapped idea).*

## Contribution

Contributions are welcome! If you want to improve this module, feel free to open an issue or submit a pull request.

## License

This project is under the MIT license. See the [LICENSE](LICENSE) file for more details.