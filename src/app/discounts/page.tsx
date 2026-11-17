"use client";

import { useEffect, useRef, useState } from "react";
import { admin } from "@/lib/api";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Trash2, Tag, Copy, Eye, X, Edit2, Check, History } from "lucide-react";
import { DataTable, type Column } from "@/components/ui/data-table";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { formatFlatDiscount, toBasisPoints, toMinorUnits, toWholeCredits, toRedemptionCap } from "@/lib/discount-amount";

const CopyCode = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied properly!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="inline-flex items-center gap-2 bg-muted px-2 py-1 rounded-md font-mono text-sm font-bold text-foreground">
      {code}
      <button 
        className="text-muted-foreground hover:text-foreground transition-colors"
        onClick={handleCopy}
        title="Copy to clipboard"
      >
        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
};

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedDiscount, setSelectedDiscount] = useState<any>(null);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [showRedemptionsModal, setShowRedemptionsModal] = useState(false);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const redemptionsRequest = useRef(0);
  const [redemptionsError, setRedemptionsError] = useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createData, setCreateData] = useState<{ code: string; name: string; kind: string; amount: number | string; currency_code: string; max_redemptions: number | string; expires_at: string }>({ code: "", name: "", kind: "percentage", amount: 0, currency_code: "USD", max_redemptions: 0, expires_at: "" });
  const [createLoading, setCreateLoading] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState<{ status: string; max_redemptions: number | string; expires_at: string }>({ status: "active", max_redemptions: 0, expires_at: "" });
  const [editLoading, setEditLoading] = useState(false);

  const fetchDiscounts = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { getAccessToken } = await import("@/lib/auth");
      const token = getAccessToken() || undefined;
      const response = await admin.getDiscounts(token);
      setDiscounts(response || []);
    } catch (err) {
      console.error("Failed to fetch discounts", err);
      setLoadError(err instanceof Error ? err.message : "Unable to load discounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId || deleteLoading) return;
    setDeleteLoading(true);
    try {
      const { getAccessToken } = await import("@/lib/auth");
      const token = getAccessToken() || undefined;
      await admin.deleteDiscount(deleteConfirmId, token);
      toast.success("Discount disabled successfully");
      setDeleteConfirmId(null);
      fetchDiscounts();
    } catch (err) {
      console.error("Failed to delete discount", err);
      toast.error(err instanceof Error ? err.message : "Unable to disable discount");
    } finally {
      setDeleteLoading(false);
    }
  };

  const closeRedemptions = () => {
    redemptionsRequest.current += 1;
    setShowRedemptionsModal(false);
  };

  const handleViewRedemptions = async (discount: any) => {
    const request = ++redemptionsRequest.current;
    setSelectedDiscount(discount);
    setShowRedemptionsModal(true);
    setRedemptionsLoading(true);
    setRedemptionsError(null);
    setRedemptions([]);
    try {
      const { getAccessToken } = await import("@/lib/auth");
      const token = getAccessToken() || undefined;
      const response = await admin.getDiscountRedemptions(discount.id, token);
      if (request === redemptionsRequest.current) setRedemptions(response || []);
    } catch (err) {
      console.error("Failed to fetch redemptions", err);
      if (request === redemptionsRequest.current) setRedemptionsError(err instanceof Error ? err.message : "Unable to load redemptions");
    } finally {
      if (request === redemptionsRequest.current) setRedemptionsLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreateLoading(true);
    try {
      const { getAccessToken } = await import("@/lib/auth");
      const token = getAccessToken() || undefined;
      const maxUses = toRedemptionCap(createData.max_redemptions, createData.kind !== "bonus_credits");
      const finalValue =
        createData.kind === "percentage"
          ? toBasisPoints(createData.amount)
          : createData.kind === "flat"
            ? toMinorUnits(createData.amount, createData.currency_code)
            : toWholeCredits(createData.amount);

      await admin.createDiscount({
        code: createData.code,
        name: createData.name,
        kind: createData.kind,
        value: finalValue,
        ...(createData.kind === "flat" ? { currency_code: createData.currency_code.trim().toUpperCase() } : {}),
        max_redemptions: maxUses,
        expires_at: createData.expires_at ? new Date(createData.expires_at).toISOString() : null,
      }, token);
      setShowCreateModal(false);
      setCreateData({ code: "", name: "", kind: "percentage", amount: 0, currency_code: "USD", max_redemptions: 0, expires_at: "" });
      toast.success("Discount created successfully");
      fetchDiscounts();
    } catch (err: any) {
      console.error("Failed to create discount", err);
      toast.error(err instanceof Error ? err.message : "Failed to create discount");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleOpenEdit = (discount: any) => {
    setSelectedDiscount(discount);
    setEditData({
      status: discount.status || "active",
      max_redemptions: discount.max_redemptions ?? discount.max_uses ?? 0,
      expires_at: discount.expires_at ? new Date(discount.expires_at).toISOString().split('T')[0] : ""
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    setEditLoading(true);
    try {
      const originalCap = selectedDiscount.max_redemptions ?? selectedDiscount.max_uses ?? null;
      const isMoney = (selectedDiscount.kind || selectedDiscount.type) !== "bonus_credits";
      const cap = toRedemptionCap(editData.max_redemptions, false);
      const capChanged = cap !== originalCap;
      // Disable legacy uncapped codes without changing their commercial terms.
      if (isMoney && (capChanged || editData.status === "active") && cap === null) {
        throw new RangeError("Payment discounts require a positive whole-number max-use cap");
      }
      if (capChanged && cap !== null && cap < (selectedDiscount.redemptions_used ?? selectedDiscount.times_used ?? 0)) {
        throw new RangeError("Max uses cannot be lower than the number already redeemed");
      }
      const changes: Record<string, unknown> = {};
      if (editData.status !== selectedDiscount.status) changes.status = editData.status;
      if (capChanged) changes.max_redemptions = cap;
      const originalDate = selectedDiscount.expires_at
        ? new Date(selectedDiscount.expires_at).toISOString().split("T")[0] : "";
      if (editData.expires_at !== originalDate) {
        changes.expires_at = editData.expires_at ? new Date(editData.expires_at).toISOString() : null;
      }
      if (Object.keys(changes).length === 0) {
        setShowEditModal(false);
        return;
      }
      const { getAccessToken } = await import("@/lib/auth");
      const token = getAccessToken() || undefined;
      await admin.updateDiscount(selectedDiscount.id, changes, token);
      setShowEditModal(false);
      toast.success("Discount updated successfully");
      fetchDiscounts();
    } catch (err: any) {
      console.error("Failed to update discount", err);
      toast.error(err instanceof Error ? err.message : "Failed to update discount");
    } finally {
      setEditLoading(false);
    }
  };

  const discountColumns: Column<any>[] = [
    {
      key: "code",
      header: "Code",
      render: (discount) => <CopyCode code={discount.code} />,
    },
    {
      key: "status",
      header: "Status",
      render: (discount) => {
        const s = discount.status || "draft";
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s === 'active' ? 'bg-emerald-100 text-emerald-700' : s === 'draft' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
            {s}
          </span>
        );
      },
    },
    {
      key: "kind",
      header: "Kind",
      render: (discount) => <span className="capitalize">{discount.kind || discount.type}</span>,
    },
    {
      key: "value",
      header: "Value",
      render: (discount) => {
        const val = discount.value ?? discount.amount;
        const kind = discount.kind || discount.type;
        return (
          <span className="font-medium">
            {kind === "percentage" ? `${val / 100}%` : kind === "bonus_credits" ? `${val} credits` : formatFlatDiscount(Number(val), discount.currency_code || "USD")}
          </span>
        );
      },
    },
    {
      key: "usage",
      header: "Usage",
      render: (discount) => {
        const used = discount.redemptions_used ?? discount.times_used ?? 0;
        const max = discount.max_redemptions ?? discount.max_uses;
        return (
          <span className="text-muted-foreground">
            {used} / {max || "∞"}
          </span>
        );
      },
    },
    {
      key: "expires",
      header: "Expires",
      render: (discount) => (
        <span className="text-muted-foreground">
          {discount.expires_at ? new Date(discount.expires_at).toLocaleDateString() : "Never"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (discount) => (
        <div className="flex justify-end">
          <Button 
            variant="ghost" 
            size="icon" 
            className="hover:bg-muted/50"
            onClick={() => handleViewRedemptions(discount)}
            title="View Redemptions"
          >
            <Eye className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="hover:bg-muted/50 ml-1"
            onClick={() => handleOpenEdit(discount)}
            title="Edit Discount"
          >
            <Edit2 className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive ml-1"
            onClick={() => handleDelete(discount.id)}
            title="Disable Discount"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <a
            href={`/audit?target_type=discount&target_id=${discount.id}`}
            className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors ml-1"
            title="View audit history"
          >
            <History className="w-4 h-4" />
          </a>
        </div>
      ),
    },
  ];

  const redemptionColumns: Column<any>[] = [
    {
      key: "user",
      header: "User",
      render: (red) => (
        <div>
          <span className="font-medium text-sm block">{red.full_name || red.user_id}</span>
          {red.email && <span className="text-muted-foreground text-xs">{red.email}</span>}
        </div>
      ),
    },
    {
      key: "redeemed_at",
      header: "Redeemed At",
      render: (red) => (
        <span className="text-muted-foreground text-xs">
          {new Date(red.redeemed_at).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Discounts</h1>
          <p className="text-muted-foreground">Manage coupon codes and promotional offers.</p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" /> New Discount
        </Button>
      </div>

      {loadError ? (
        <div role="alert" className="rounded-md border border-destructive p-4">
          <p>Unable to load discounts: {loadError}</p>
          <Button variant="outline" onClick={fetchDiscounts}>Retry discounts</Button>
        </div>
      ) : <DataTable
        columns={discountColumns} 
        data={discounts} 
        isLoading={loading} 
        keyExtractor={(d) => d.id} 
        emptyMessage={
          <div className="flex flex-col items-center justify-center">
            <Tag className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p>No discount codes found.</p>
          </div>
        }
      />}

      {/* Redemptions Modal */}
      {showRedemptionsModal && selectedDiscount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card w-full max-w-2xl p-6 rounded-lg shadow-lg border border-border relative">
            <button 
              onClick={closeRedemptions}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-2">Redemptions: {selectedDiscount.code}</h2>
            <p className="text-sm text-muted-foreground mb-4">View users who have redeemed this discount code.</p>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {redemptionsError ? (
                <div role="alert" className="space-y-2">
                  <p>Unable to load redemptions: {redemptionsError}</p>
                  <Button variant="outline" onClick={() => handleViewRedemptions(selectedDiscount)}>Retry redemptions</Button>
                </div>
              ) : <DataTable
                columns={redemptionColumns} 
                data={redemptions} 
                isLoading={redemptionsLoading} 
                keyExtractor={(r: any) => r.id || Math.random().toString()} 
                emptyMessage={
                  <div className="text-center text-muted-foreground">
                    No redemptions found for this discount yet.
                  </div>
                }
              />}
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={closeRedemptions}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Discount Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card w-full max-w-lg p-6 rounded-lg shadow-lg border border-border relative">
            <button 
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-4">Create New Discount</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Code</label>
                  <input type="text" value={createData.code} onChange={e => setCreateData({...createData, code: e.target.value.toUpperCase()})} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm" placeholder="e.g. SUMMER50" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Name <span className="text-destructive">*</span></label>
                  <input type="text" value={createData.name} onChange={e => setCreateData({...createData, name: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm" placeholder="e.g. Summer Sale" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Kind</label>
                  <select value={createData.kind} onChange={e => setCreateData({...createData, kind: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm">
                    <option value="percentage">Percentage</option>
                    <option value="flat">Flat Amount</option>
                    <option value="bonus_credits">Bonus Credits</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Amount ({createData.kind === "percentage" ? "%" : createData.kind === "bonus_credits" ? "credits" : createData.currency_code})
                  </label>
                  <input type="number" value={createData.amount === "" ? "" : createData.amount} onChange={e => setCreateData({...createData, amount: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm" />
                </div>
              </div>
              {createData.kind === "flat" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Currency Code <span className="text-destructive">*</span></label>
                  <input type="text" value={createData.currency_code} onChange={e => setCreateData({...createData, currency_code: e.target.value.toUpperCase()})} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm" placeholder="e.g. USD" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Max Uses (0 = unlimited, flat/percentage MUST have limit)</label>
                  <input type="number" value={createData.max_redemptions === "" ? "" : createData.max_redemptions} onChange={e => setCreateData({...createData, max_redemptions: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Expires At (Optional)</label>
                  <input type="date" value={createData.expires_at} onChange={e => setCreateData({...createData, expires_at: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm" />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createLoading}>
                {createLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Create Discount
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Discount Modal */}
      {showEditModal && selectedDiscount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card w-full max-w-lg p-6 rounded-lg shadow-lg border border-border relative">
            <button 
              onClick={() => setShowEditModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-4">Edit Discount: {selectedDiscount.code}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm">
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Max Uses (0 = unlimited, flat/percentage MUST have limit)</label>
                  <input type="number" value={editData.max_redemptions === "" ? "" : editData.max_redemptions} onChange={e => setEditData({...editData, max_redemptions: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Expires At (Optional)</label>
                  <input type="date" value={editData.expires_at} onChange={e => setEditData({...editData, expires_at: e.target.value})} className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm" />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={editLoading}>
                {editLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteConfirmId}
        onClose={() => { if (!deleteLoading) setDeleteConfirmId(null); }}
        onConfirm={confirmDelete}
        title="Disable Discount"
        description="This stops new uses of the discount code. Past redemptions and payments already in progress are preserved."
        isLoading={deleteLoading}
        confirmText="Disable"
        isDestructive={true}
      />
    </div>
  );
}
