import { BadRequestException } from "@nestjs/common";

export type SupportedAsset = {
  assetCode: string;
  network: string;
  decimals: number;
  withdrawFee: string;
};

export const supportedAssets: SupportedAsset[] = [
  {
    assetCode: "TON",
    network: "TON",
    decimals: 9,
    withdrawFee: "0.05",
  },
  {
    assetCode: "USDT",
    network: "TON",
    decimals: 6,
    withdrawFee: "1",
  },
  {
    assetCode: "USDT",
    network: "TRC20",
    decimals: 6,
    withdrawFee: "2",
  },
];

export function getSupportedAssetOrThrow(assetCode: string, network: string): SupportedAsset {
  const asset = supportedAssets.find((item) => item.assetCode === assetCode && item.network === network);

  if (!asset) {
    throw new BadRequestException(`Unsupported asset ${assetCode} on ${network}`);
  }

  return asset;
}
