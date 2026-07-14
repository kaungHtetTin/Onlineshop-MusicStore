# Product Create/Edit UI/UX Documentation

ဤ documentation သည် လက်ရှိ project တွင် အသုံးပြုထားသော Product Create/Edit UI/UX ပုံစံကို အခြား project များတွင် AI အသုံးပြု၍ ပြန်လည် ဖန်တီးနိုင်ရန် ရည်ရွယ်ပါသည်။

## UI/UX Design Overview

လက်ရှိ UI သည် **Material UI (MUI)** ကို အခြေခံထားပြီး **Compact (Dense) Design** ကို အသုံးပြုထားပါသည်။ အဓိက အချက်များမှာ-

1.  **Layout Structure**:
    - `Stack` ကို အသုံးပြု၍ Vertical spacing (`spacing={2}`) ပေးထားသည်။
    - Content များကို `Card variant="outlined"` များဖြင့် group လုပ်ထားသည်။
2.  **Color Palette**:
    - Primary: `#1565c0` (Blue)
    - Secondary: `#00838f` (Teal)
    - Background: `#f0f3f7` (Light Grey)
3.  **Typography**:
    - "DM Sans" font ကို အသုံးပြုပြီး Base font size သည် 13px ဖြစ်သည်။
    - Dense UI ဖြစ်သည့်အတွက် စာလုံးအရွယ်အစားများကို သေးငယ်သော်လည်း ဖတ်ရလွယ်အောင် စီစဉ်ထားသည်။
4.  **Responsive Design**:
    - Mobile screen များတွင် Form field များသည် vertical stack ဖြစ်သွားပြီး Desktop တွင် horizontal stack (`sm: 'row'`) ဖြစ်သည်။

## Functional Sections

1.  **Header Actions**:
    - "Back" button နှင့် "Save/Delete" buttons များသည် ထိပ်ဆုံးတွင် တည်ရှိသည်။
2.  **Basic Information**:
    - Product Title, Description, Status, Category စသည်တို့ကို Card တစ်ခုတည်းတွင် စုစည်းထားသည်။
3.  **Image Management**:
    - Multi-image upload စနစ်။
    - Square crop လုပ်နိုင်သော functionality ပါဝင်သည်။
    - Images များကို Horizontal scroll လုပ်၍ ကြည့်ရှုနိုင်ပြီး Cover image ရွေးချယ်ခြင်းနှင့် Reorder လုပ်ခြင်းများ ပြုလုပ်နိုင်သည်။
4.  **Product Options**:
    - Dynamic ဖြစ်သော Option များ (ဥပမာ- Size, Color) ကို comma-separated values များဖြင့် ထည့်သွင်းနိုင်သည်။
5.  **Variants (SKUs)**:
    - Options များအပေါ် မူတည်၍ Variants များကို Auto-generate လုပ်ပေးသည်။
    - Variant တစ်ခုချင်းစီအတွက် သီးသန့် ပုံ၊ ဈေးနှုန်း၊ လက်ကျန်အရေအတွက် နှင့် SKU code များ သတ်မှတ်နိုင်သည်။

---

## AI Prompt (For Recreating this UI)

အောက်ပါ Prompt ကို အသုံးပြု၍ AI (ဥပမာ- ChatGPT, Claude သို့မဟုတ် Trae) အား အလားတူ UI တစ်ခု ရေးခိုင်းနိုင်ပါသည်။

```markdown
Act as a Senior Frontend Engineer. I want you to create a React component for a "Product Create/Edit" page using Material UI (MUI). The UI should follow a compact and professional dense design.

### Design Requirements:

- Use MUI v5.
- Layout: Use a vertical `Stack` with `spacing={2}`. Group sections into `Card variant="outlined"` with a `borderRadius` of 8px.
- Typography: Use a small base font size (around 13px). Buttons and input fields should use `size="small"`.
- Color Scheme: Primary color `#1565c0`, Secondary `#00838f`, Background `#f0f3f7`.
- Responsiveness: Form fields should stack vertically on mobile and horizontally where appropriate on larger screens.

### Features to Include:

1. **Header**: A top section with a "Back" button on the left and "Save/Delete" buttons on the right.
2. **Basic Info Section**: Input fields for Title (required), Description (multiline), Status (Select: Active/Inactive), and Category (Select).
3. **Image Management Section**:
   - A button to "Upload Images".
   - A horizontal scrollable area to display uploaded images as small cards.
   - Each image card should have "Set as Cover", "Remove", and "Reorder (Left/Right)" buttons.
   - Show a "Cover" chip on the main image.
4. **Options Section**:
   - Ability to add multiple product options (e.g., Size, Color).
   - Each option has a name field and a "Values" field (comma-separated tags).
5. **Variants (SKUs) Section**:
   - A button to "Generate Variants" based on options.
   - A list of Variant cards. Each variant card should include:
     - Title (e.g., "Red / XL").
     - Image selector (select from uploaded product images).
     - Input fields for SKU Code, Barcode, Price (number), and Stock (number).
     - An "Active" toggle checkbox.
6. **State Management**: Use React `useState` to manage all these fields, including the dynamic addition of options and variants.

### Implementation Style:

- Use clean, modular React code with Hooks.
- Ensure the UI looks clean, professional, and follows the "Dense" UI pattern (tight padding, small controls).
- Use `Stack`, `Box`, `Card`, `Typography`, `TextField`, `Button`, `Chip`, and `Select` components from MUI.
```

---

## Reference Code Locations (In this Project)

- **Main Component**: [RetailProductFormPage.jsx](file:///c:/xampp/htdocs/transform-your-business/client/src/modules/retail/operator/RetailProductFormPage.jsx)
- **Global Theme**: [theme.js](file:///c:/xampp/htdocs/transform-your-business/client/src/theme.js)
- **UI Guidelines**: [UI.md](file:///c:/xampp/htdocs/transform-your-business/client/docs/UI.md)
