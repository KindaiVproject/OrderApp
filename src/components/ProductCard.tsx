"use client";

type ProductCardData = {
  id: string;
  name: string;
  price: number;
  imageUrl: string | null;
};

export default function ProductCard({
  product,
  onClick,
  compact = false,
}: {
  product: ProductCardData;
  onClick: () => void;
  compact?: boolean;
}) {
  const priceLabel = product.price === 0 ? "0円" : `${product.price}円`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative aspect-square overflow-hidden rounded-lg border border-neutral-200 text-left active:opacity-80 ${
        product.imageUrl ? "" : "flex flex-col items-center justify-center gap-1 bg-neutral-50 px-2 text-center"
      }`}
    >
      {product.imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div
            className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-2 pb-1.5 ${
              compact ? "pt-3" : "pt-6"
            }`}
          >
            <span className={`block truncate font-medium text-white ${compact ? "text-xs" : "text-sm"}`}>
              {product.name}
            </span>
            <span className={`block text-white/80 ${compact ? "text-[10px]" : "text-xs"}`}>{priceLabel}</span>
          </div>
        </>
      ) : (
        <>
          <span className={`font-medium text-neutral-800 ${compact ? "text-xs" : "text-sm"}`}>
            {product.name}
          </span>
          <span className={`text-neutral-500 ${compact ? "text-[10px]" : "text-xs"}`}>{priceLabel}</span>
        </>
      )}
    </button>
  );
}
