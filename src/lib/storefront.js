export function arrangeStorefrontProducts(products = [], settings = {}) {
  const order = (settings.productOrder || []).map(Number);
  const featuredIds = new Set((settings.featuredProductIds || []).map(Number));
  const originalIndex = new Map(products.map((product, index) => [Number(product.id), index]));

  const sorted = [...products].sort((a, b) => {
    const aPosition = order.indexOf(Number(a.id));
    const bPosition = order.indexOf(Number(b.id));
    const aRank = aPosition < 0 ? order.length + (originalIndex.get(Number(a.id)) || 0) : aPosition;
    const bRank = bPosition < 0 ? order.length + (originalIndex.get(Number(b.id)) || 0) : bPosition;
    return aRank - bRank;
  });

  return {
    featured: sorted.filter((product) => featuredIds.has(Number(product.id))),
    collection: sorted.filter((product) => !featuredIds.has(Number(product.id))),
    all: sorted,
  };
}
