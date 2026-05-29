# FlowScript Issues & Improvements

This document tracks bugs, polish items, and future ideas discovered while using FlowScript before and after v1.0.0.

---

## Table of Contents
- [Bugs](#bugs)
- [Improvements](#improvements)
- [Ideas / Future](#ideas--future)

---

## Bugs
(Things that are broken, inconsistent, or not behaving as intended.)

- [ ] Weird bug with edges. might be because legacy save?

---

## Improvements
(Small UX tweaks, polish, or quality-of-life upgrades.)

- [ ] Free Trial / License key stuff / free .frame mode

---

## Ideas / Future
(Explorations, nice-to-haves, or potential features for later versions.)

- [ ] Nothing noted

---

## Completed
- [x] Sometimes the open recent menu doesn't open
- [x] graph.zoomall not consistent: should be: zoom(node name or all)
- [x] Shapes background means you can't click through
- [x] Shapes are deleted when switching from GRAPH to CODE and back
- [x] User created themes not deleted
- [x] Windows icon missing (default electron)
- [x] The now transparent teal element should be the same color as the pins; causing a bug inside groups
- [x] Go into a node and a new button appears: +Property. Special node with no pins, name, type, opt constraints then visual feedback on parent node
- [x] Copy/Paste Node (via FlowCommand, context menu, shortcut)
- [x] Up arrow key shows last command
- [x] Visual feedback on selected node
- [x] Del key deletes selected node(s)
- [x] Parent pins should be movable
- [x] New node type: Note: but larger than other notes, has text on bg
- [x] If file is dirty; no Unsaved warning before closing
- [x] Notes should have a different background color
- [x] When pasting a node, it should only select the pasted node and not the one you had selected previously
- [x] addShape(Rectangle)
- [x] Node Templates; save a node and what's in it (group or properties) to be picked from a palette and reused
- [x] Auto close parentheses when adding one just like Typora
- [x] Create Themes directly in FlowScript: FlowBar command pops the modal. newTheme(name)
- [x] FlowBar command: cookNode(name) "cooks" the node by darkening their colors until almost black. Any action on it restores it (easter egg)
- [x] Found a bug type of modal window for users that find issues
- [x] File -> New -> Frame Walker file (.frame)
- [x] Rename New FlowScript to New .flowscript
- [x] Rename New Frame to New .frame
- [x] Reduce shape thickness by 50%
- [x] Auto set theme to Frame Walker when switching to .frame and set back to whatever theme it was in FlowScript when switching back
- [x] Hovering over Frame Walker node headers should show a tooltip with a description
- [x] Titlebar font color too dark
- [x] Adapt FlowBar to .frame mode
- [x] Undo/Redo?
- [x] Gateway node position not saved
- [x] Shard theme accent color is same as Default FlowScript theme. Should be #9E77ED
- [x] FlowBar Command: babyNode(name) node tiny -> grows to size