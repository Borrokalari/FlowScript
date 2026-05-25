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

- [x] Windows icon missing (default electron)
- [x] The now transparent teal element should be the same color as the pins; causing a bug inside groups
- [ ] Weird bug with edges. might be because legacy save?

---

## Improvements
(Small UX tweaks, polish, or quality-of-life upgrades.)

- [ ] File -> New -> Frame Walker file (.frame)
- [x] Go into a node and a new button appears: +Property. Special node with no pins, name, type, opt constraints then visual feedback on parent node
- [x] Copy/Paste Node (via FlowCommand, context menu, shortcut)
- [x] Up arrow key shows last command
- [x] Visual feedback on selected node
- [x] Del key deletes selected node(s)
- [x] Parent pins should be movable
- [x] New node type: Note: but larger than other notes, has text on bg
- [x] If file is dirty; no Unsaved warning before closing

---

## Ideas / Future
(Explorations, nice-to-haves, or potential features for later versions.)

- [ ] Custom nodes: create entirely new node types
- [x] Node Templates; save a node and what's in it (group or properties) to be picked from a palette and reused
- [x] Auto close parentheses when adding one just like Typora
- [ ] Create Themes directly in FlowScript: Modal? CODE? FlowBar?
- [x] FlowBar command: cookNode(name) "cooks" the node by darkening their colors until almost black. Any action on it restores it (easter egg)

---

## Completed
- [x] No known completed