Properties inside Nodes

------

# ⭐ What “Property Elements as small cards” looks like

Inside a node, when you click **+ Property**, FlowScript creates a **property card** — a small rectangular element with:

- **Name field**
- **Type dropdown** (slider, checkbox, dropdown, number, text)
- **Optional constraints** depending on type
- **Delete icon**
- **Reorder handle** (optional)

These cards float inside the node’s internal canvas, just like child nodes do — but they’re visually distinct:

- No pins
- No edges
- Smaller footprint
- Light background
- Rounded corners
- A subtle icon indicating “property”

Think of them like **metadata tiles**.

------

# ⭐ How the UX flows

### **1. You open a node**

You see:

- `+ Node`
- `+ Property`
- `^ Up`

### **2. You click + Property**

A card appears:

```
[ Property ]
Name: ________
Type: [ slider ▾ ]
```

If you choose “slider,” the card expands:

```
[ Property ]
Name: efficiency
Type: slider
Min: 0
Max: 2
Default: 1
```

If you choose “dropdown,” it expands differently:

```
[ Property ]
Name: mode
Type: dropdown
Options:
- auto
- manual
- off
```

### **3. You go Up**

The node is now:

- still a normal node
- but with a **property indicator** (like a tiny wrench or “3 props” badge)
- and the properties are stored in the node’s metadata

No group logic.
 No nested graph.
 Just a node with configuration.

------

# ⭐ Why this is the best design for FlowScript

### **1. It keeps FlowScript pure**

You’re not turning it into a full inspector‑driven editor.
 Properties are optional, lightweight, and embedded.

### **2. It keeps FlowScript general‑purpose**

Anyone can use properties for:

- simulations
- prototypes
- automation flows
- data pipelines
- game logic
- anything

FlowScript stays universal.

### **3. It gives Frame Walker exactly what it needs**

Frame Walker simply checks:

- Does this node have a property named “efficiency”?
- Is it a slider?
- What’s the value?
- Clamp it to allowed ranges.

You get safe modding without restricting FlowScript.

### **4. It avoids UI clutter**

No giant inspector panel.
 No sidebars.
 No modal windows.

Everything stays inside the node.

### **5. It fits your aesthetic**

FlowScript is about:

- clarity
- modularity
- visual logic
- minimalism

Property cards inside nodes feel like a natural extension of that.

------

# ⭐ How this interacts with Frame Walker

Frame Walker doesn’t care how the properties were created — only that:

- the node type matches
- the property names match
- the values are valid

So if someone creates:

```
Property: efficiency
Type: slider
Value: 999
```

Frame Walker clamps it to 2.0 internally.

If someone creates:

```
Property: colorMode
Type: dropdown
```

Frame Walker ignores it.

This gives you:

- **creative freedom**
- **safe modding**
- **no cheating**
- **no tight coupling**

Perfect.