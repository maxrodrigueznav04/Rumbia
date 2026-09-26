import VisualAsset from '../models/VisualAsset.js';
import ApiError from '../utils/ApiError.js';

export async function loadVisualDesignAssets(design, agencyId) {
  const ids = [...new Set(design.pages.flatMap((page) => page.elements)
    .filter((element) => (element.type === 'image' || element.type === 'artwork') && element.assetId).map((element) => element.assetId))];
  if (!ids.length) return [];
  const assets = await VisualAsset.find({ _id: { $in: ids }, agency: agencyId })
    .select('url width height').lean();
  if (assets.length !== ids.length) throw ApiError.badRequest('Una imagen no pertenece a la biblioteca de esta agencia.');
  return assets;
}
