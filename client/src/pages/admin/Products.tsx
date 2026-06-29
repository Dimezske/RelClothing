import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";
import ColorSwatches from "@/components/ColorSwatches";

type ProductVariant = {
  id?: number;
  name: string;
  colorHexes: string;
};

type Product = {
  id: number;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  imageUrl: string;
  sizes: string;
  inStock: boolean;
  oneSizeFitsAll: boolean;
  salePercent: number | null;
  saleActive: boolean;
  variants?: { id: number; name: string; colorHexes: string }[];
};

type ProductFormState = {
  id?: number;
  slug: string;
  name: string;
  description: string;
  price: string;
  category: string;
  imageUrl: string;
  sizes: string;
  inStock: boolean;
  oneSizeFitsAll: boolean;
  salePercent: string;
  saleActive: boolean;
  variants: ProductVariant[];
};

const EMPTY_FORM: ProductFormState = {
  slug: "",
  name: "",
  description: "",
  price: "",
  category: "",
  imageUrl: "",
  sizes: "",
  inStock: true,
  oneSizeFitsAll: false,
  salePercent: "",
  saleActive: false,
  variants: [],
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function AdminProducts() {
  const utils = trpc.useUtils();
  const productsQuery = trpc.products.list.useQuery();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const invalidate = () => {
    utils.products.list.invalidate();
  };

  const createProduct = trpc.admin.createProduct.useMutation({ onSuccess: () => { invalidate(); setFormOpen(false); } });
  const updateProduct = trpc.admin.updateProduct.useMutation({ onSuccess: () => { invalidate(); setFormOpen(false); } });
  const deleteProduct = trpc.admin.deleteProduct.useMutation({
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
    },
  });
  const toggleSale = trpc.admin.toggleProductSale.useMutation({ onSuccess: () => invalidate() });

  const products = productsQuery.data ?? [];
  const mutation = form.id ? updateProduct : createProduct;

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(product: Product) {
    setForm({
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      price: (product.priceCents / 100).toFixed(2),
      category: product.category,
      imageUrl: product.imageUrl,
      sizes: (JSON.parse(product.sizes) as string[]).join(", "),
      inStock: product.inStock,
      oneSizeFitsAll: product.oneSizeFitsAll,
      salePercent: product.salePercent != null ? String(product.salePercent) : "",
      saleActive: product.saleActive,
      variants: (product.variants ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        colorHexes: (JSON.parse(v.colorHexes) as string[]).join(", "),
      })),
    });
    setFormOpen(true);
  }

  function submit() {
    const priceCents = Math.round(parseFloat(form.price || "0") * 100);
    const sizes = form.sizes
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const variants = form.variants
      .filter((v) => v.name.trim() && v.colorHexes.trim())
      .map((v) => ({
        name: v.name.trim(),
        colorHexes: v.colorHexes
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      }));

    const salePercent = form.salePercent.trim() ? Math.round(parseFloat(form.salePercent)) : null;

    const payload = {
      slug: form.slug || slugify(form.name),
      name: form.name,
      description: form.description,
      priceCents,
      category: form.category,
      imageUrl: form.imageUrl,
      sizes,
      inStock: form.inStock,
      oneSizeFitsAll: form.oneSizeFitsAll,
      salePercent,
      // A sale can't be "on" without a percentage to apply.
      saleActive: form.saleActive && salePercent != null,
      variants,
    };

    if (form.id) {
      updateProduct.mutate({ id: form.id, ...payload });
    } else {
      createProduct.mutate(payload);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">Add new items — they appear in the shop immediately.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add product
        </Button>
      </div>

      {productsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading products…</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products yet. Add your first one.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Sizes</TableHead>
                <TableHead>Colors</TableHead>
                <TableHead>Sale</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <img src={product.imageUrl} alt={product.name} className="h-12 w-10 rounded-sm object-cover" />
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{product.category}</TableCell>
                  <TableCell className="tabular-nums">
                    {product.saleActive && product.salePercent ? (
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground line-through">
                          {formatPrice(product.priceCents)}
                        </span>
                        <span className="font-medium">
                          {formatPrice(Math.round(product.priceCents * (1 - product.salePercent / 100)))}
                        </span>
                      </div>
                    ) : (
                      formatPrice(product.priceCents)
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {product.oneSizeFitsAll ? "One size" : (JSON.parse(product.sizes) as string[]).join(", ")}
                  </TableCell>
                  <TableCell>
                    {product.variants && product.variants.length > 0 ? (
                      <ColorSwatches
                        variants={product.variants.map((v) => ({
                          id: v.id,
                          name: v.name,
                          colorHexes: JSON.parse(v.colorHexes),
                        }))}
                        size="xs"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={product.saleActive}
                        disabled={!product.salePercent || toggleSale.isPending}
                        aria-label={`Toggle sale for ${product.name}`}
                        onCheckedChange={(checked) => toggleSale.mutate({ id: product.id, saleActive: checked })}
                      />
                      {product.salePercent ? (
                        <span className="text-xs text-muted-foreground">{product.salePercent}% off</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">No discount set</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.inStock ? "default" : "outline"}>
                      {product.inStock ? "In stock" : "Sold out"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(product)} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteTarget(product)}
                      aria-label="Delete"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        form={form}
        setForm={setForm}
        onSubmit={submit}
        isPending={mutation.isPending}
        error={mutation.error?.message}
        isEditing={!!form.id}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the product from the shop. Past orders referencing it are unaffected.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteProduct.isPending}
              onClick={() => deleteTarget && deleteProduct.mutate({ id: deleteTarget.id })}
            >
              {deleteProduct.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductFormDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
  isPending,
  error,
  isEditing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ProductFormState;
  setForm: (updater: (prev: ProductFormState) => ProductFormState) => void;
  onSubmit: () => void;
  isPending: boolean;
  error?: string;
  isEditing: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileSelected(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/uploads/product-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dataUrl }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");

      setForm((prev) => ({ ...prev, imageUrl: data.url }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit product" : "Add product"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-slug">Slug (URL)</Label>
            <Input
              id="p-slug"
              placeholder={form.name ? slugify(form.name) : "auto-generated-from-name"}
              value={form.slug}
              onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-description">Description</Label>
            <Textarea
              id="p-description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-price">Price (USD)</Label>
              <Input
                id="p-price"
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-category">Category</Label>
              <Input
                id="p-category"
                placeholder="Outerwear, Tops, …"
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
            <Label htmlFor="p-onesize" className="cursor-pointer">
              One size fits all
              <span className="block text-xs font-normal text-muted-foreground">
                Skips the size selector on the shop — use for crystals and most accessories.
              </span>
            </Label>
            <Switch
              id="p-onesize"
              checked={form.oneSizeFitsAll}
              onCheckedChange={(checked) =>
                setForm((prev) => ({ ...prev, oneSizeFitsAll: checked, sizes: checked ? "One Size" : prev.sizes }))
              }
            />
          </div>

          {!form.oneSizeFitsAll && (
            <div className="space-y-1.5">
              <Label htmlFor="p-sizes">Sizes (comma separated)</Label>
              <Input
                id="p-sizes"
                placeholder="S, M, L, XL"
                value={form.sizes}
                onChange={(e) => setForm((prev) => ({ ...prev, sizes: e.target.value }))}
              />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Color variants</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    variants: [...prev.variants, { name: "", colorHexes: "" }],
                  }))
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Add color
              </Button>
            </div>
            {form.variants.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No colors yet. Products without variants just show one default image.
              </p>
            ) : (
              <div className="space-y-2">
                {form.variants.map((variant, i) => {
                  const previewHexes = variant.colorHexes
                    .split(",")
                    .map((c) => c.trim())
                    .filter((c) => /^#[0-9a-fA-F]{3,8}$/.test(c));
                  return (
                    <div key={i} className="flex items-center gap-2">
                      {previewHexes.length > 0 && (
                        <ColorSwatches variants={[{ name: variant.name || "preview", colorHexes: previewHexes }]} size="sm" />
                      )}
                      <Input
                        placeholder="Color name (e.g. Ink Black)"
                        value={variant.name}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            variants: prev.variants.map((v, vi) => (vi === i ? { ...v, name: e.target.value } : v)),
                          }))
                        }
                        className="flex-1"
                      />
                      <Input
                        placeholder="#1c1c1c or #aaa,#bbb for multi"
                        value={variant.colorHexes}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            variants: prev.variants.map((v, vi) =>
                              vi === i ? { ...v, colorHexes: e.target.value } : v,
                            ),
                          }))
                        }
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove color"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            variants: prev.variants.filter((_, vi) => vi !== i),
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Product image</Label>
            <div className="flex items-center gap-3">
              {form.imageUrl && (
                <img src={form.imageUrl} alt="Preview" className="h-16 w-14 rounded-sm border object-cover" />
              )}
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Image URL, or upload below"
                  value={form.imageUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelected(file);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? "Uploading…" : "Upload image"}
                </Button>
                {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-md border px-3 py-2.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="p-sale" className="cursor-pointer">
                On sale
                <span className="block text-xs font-normal text-muted-foreground">
                  Shows a strikethrough price and a discount badge on the shop.
                </span>
              </Label>
              <Switch
                id="p-sale"
                checked={form.saleActive}
                disabled={!form.salePercent.trim()}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, saleActive: checked }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="p-sale-percent"
                type="number"
                min={1}
                max={99}
                placeholder="e.g. 20"
                value={form.salePercent}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    salePercent: e.target.value,
                    // Clearing the percent also turns the sale off — can't
                    // have an active sale with nothing to discount by.
                    saleActive: e.target.value.trim() ? prev.saleActive : false,
                  }))
                }
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">% off</span>
              {form.salePercent.trim() && form.price && (
                <span className="text-sm text-muted-foreground">
                  {formatPrice(Math.round(parseFloat(form.price) * 100))} →{" "}
                  {formatPrice(
                    Math.round(
                      Math.round(parseFloat(form.price) * 100) *
                        (1 - Math.min(99, Math.max(1, parseFloat(form.salePercent) || 0)) / 100),
                    ),
                  )}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
            <Label htmlFor="p-instock" className="cursor-pointer">
              In stock
            </Label>
            <Switch
              id="p-instock"
              checked={form.inStock}
              onCheckedChange={(checked) => setForm((prev) => ({ ...prev, inStock: checked }))}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isPending || !form.name || !form.imageUrl || !form.sizes}>
            {isPending ? "Saving…" : isEditing ? "Save changes" : "Add product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
