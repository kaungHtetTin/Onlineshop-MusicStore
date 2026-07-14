# Product Management System Specification

This document provides the technical specifications and UI/UX flows for the Product Management module (including Products, Categories, and SKUs) used in this project. You can use these specifications to implement a similar system in other applications.

## 1. Backend Specifications

### Tech Stack

- **Framework**: Laravel 10+
- **Database**: MySQL 8.0+
- **File Storage**: Local Disk or Cloud Storage (S3-compatible)

### Database Schema

#### `categories`

Manages hierarchical product categorization.

- `id`: BigInt (Primary Key)
- `business_id`: BigInt (Foreign Key to Businesses) - For Multi-tenancy
- `parent_id`: BigInt (Self-referencing Foreign Key, Nullable)
- `name`: String(255)
- `sort_order`: Unsigned Int (Default: 0)
- `is_active`: Boolean (Default: true)
- `metadata`: JSON (Optional)

#### `products`

The main product entity.

- `id`: BigInt (Primary Key)
- `business_id`: BigInt (Foreign Key)
- `category_id`: BigInt (Foreign Key to Categories, Nullable)
- `title`: String(255)
- `description`: Text (Nullable)
- `status`: String(32) (active, inactive, draft)
- `main_image_attachment_id`: BigInt (Foreign Key to Attachments, Nullable)
- `metadata`: JSON (Stores dynamic options like `{"options": [{"name": "Color", "values": ["Red", "Blue"]}]}`)

#### `skus` (Stock Keeping Units)

Individual variants of a product (e.g., Red / Large).

- `id`: BigInt (Primary Key)
- `business_id`: BigInt (Foreign Key)
- `product_id`: BigInt (Foreign Key to Products)
- `sku_code`: String(128) (Unique per business)
- `title`: String(255) (Optional, overrides product title for variant)
- `primary_barcode`: String(128) (Nullable)
- `price`: Decimal(12, 2)
- `market_price`: Decimal(12, 2) (Nullable)
- `cost`: Decimal(12, 2) (Nullable)
- `stock_qty`: Unsigned Int (Default: 0)
- `reserved_qty`: Unsigned Int (Default: 0)
- `is_active`: Boolean (Default: true)
- `image_attachment_id`: BigInt (Foreign Key to Attachments, Nullable)
- `attributes`: JSON (Stores variant attributes like `{"color": "Red", "size": "Large"}`)

### API Endpoints

#### Categories

- `GET /api/retail/categories`: List all categories for the business.
- `POST /api/retail/categories`: Create a new category.
- `PUT /api/retail/categories/{id}`: Update category details.
- `DELETE /api/retail/categories/{id}`: Delete category (Only if no child categories or products exist).

#### Products

- `GET /api/retail/products`: List products with pagination and filters (title, category, status).
- `GET /api/retail/products/{id}`: Get full product details including images.
- `POST /api/retail/products`: Create a product and sync its gallery images.
- `PUT /api/retail/products/{id}`: Update product details and gallery.
- `DELETE /api/retail/products/{id}`: Delete product and its associated SKUs and images.

#### SKUs (Variants)

- `GET /api/retail/products/{productId}/skus`: List all SKUs for a specific product.
- `POST /api/retail/products/{productId}/skus/sync`: Bulk update/create/delete SKUs for a product. This ensures the variant list matches the provided data exactly.

---

## 2. Frontend Admin Specification

### UI Components (React + Material UI)

1. **Category Tree/List**:
    - Manage categories and sub-categories.
    - Toggle active status and adjust display order.

2. **Product List Page**:
    - Data table with search and filtering.
    - Quick actions for Edit/Delete/Toggle Status.

3. **Product Form Page**:
    - **Basic Info Section**: Title, Category selection, Description.
    - **Image Gallery Section**:
        - Multi-image upload with cropping functionality.
        - Drag-and-drop or button-based reordering.
        - "Set as Cover" functionality for the main product image.
    - **Variant (SKU) Management Section**:
        - **Option Definition**: Add options like "Color", "Size", "Material".
        - **Auto-Generation**: A "Generate Variants" button that builds a Cartesian product of all option values.
        - **SKU Grid**: A table to edit `SKU Code`, `Barcode`, `Price`, and `Stock` for each generated variant.
        - **Variant Images**: Select an image from the product gallery for each specific variant.

### Key Logic & State Management

- **Cartesian Product Generator**: A function that takes defined options (e.g., `Color: [Red, Blue]`, `Size: [S, M]`) and generates all 4 combinations.
- **SKU Code Generator**: Auto-generates readable SKU codes based on the product title and variant attributes (e.g., `SHIRT-RED-S`).
- **Barcode Generator**: Auto-generates random or sequential EAN-13 style barcodes for internal use.
- **Atomic Saving**: The form saves the product first, then uses the returned product ID to sync all SKUs in a single "Sync" API call.

---

## 3. UI/UX Flow

### Step 1: Category Setup

The operator ensures the appropriate categories exist before adding products. Categories can be nested for better organization.

### Step 2: Product Creation

1. Enter **Basic Information** (Title, Category, Description).
2. Upload **Images**. The first image is automatically set as the cover. Users can reorder images to control the gallery display.
3. Define **Options** if the product has variants. (e.g., Name: "Color", Values: ["Red", "Blue", "Green"]).
4. Click **Generate Variants**. The system populates a list of all possible combinations.
5. Edit **SKU Details**. For each variant, the user can set a specific price, stock level, and unique SKU/Barcode.
6. **Save**. The system validates that every variant has a unique attribute combination.

### Step 3: Inventory Management

Operators can return to the SKU section later to update stock levels or prices without changing the main product details.

---

## 4. Reusability Tips

- **Multi-tenancy**: Always filter by `business_id` (or `org_id`) in every query.
- **Metadata**: Use the `metadata` JSON field for features like SEO tags, warranty info, or custom display labels to avoid schema migrations.
- **Sync Pattern**: For complex relationships like Product-SKUs, the "Sync" pattern (Send the whole list, let the backend Diff and Update/Delete) is much more robust than individual SKU CRUD calls.
