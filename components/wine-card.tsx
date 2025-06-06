'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, MapPin, Calendar, DollarSign, TrendingUp } from 'lucide-react';
import Image from 'next/image';

interface WineCardProps {
  wine: {
    id: string;
    wine: string;
    vintage?: string;
    producer?: string;
    region?: string;
    varietal?: string;
    location?: string;
    bin?: string;
    price?: string;
    valuation?: string;
    readyToDrink?: boolean;
    bottleImageUrl?: string | null;
    tastingNotesSummary?: string | null;
    professionalReviews?: string[];
    communityScore?: string | null;
    cellarTrackerUrl?: string | null;
  };
}

export function WineCard({ wine }: WineCardProps) {
  const formatPrice = (price?: string) => {
    if (!price) return null;
    const num = parseFloat(price);
    return isNaN(num) ? price : `$${num.toFixed(2)}`;
  };

  const calculateROI = () => {
    if (!wine.price || !wine.valuation) return null;
    const purchase = parseFloat(wine.price);
    const current = parseFloat(wine.valuation);
    if (isNaN(purchase) || isNaN(current) || purchase === 0) return null;
    const roi = ((current - purchase) / purchase) * 100;
    return roi;
  };

  const roi = calculateROI();

  return (
    <Card className="w-full max-w-sm mx-auto hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {/* Wine bottle image */}
          <div className="w-16 h-20 shrink-0 bg-gradient-to-b from-gray-100 to-gray-200 rounded-md overflow-hidden">
            {wine.bottleImageUrl ? (
              <Image
                src={wine.bottleImageUrl}
                alt={`${wine.wine} bottle`}
                width={64}
                height={80}
                className="size-full object-cover"
                onError={(e) => {
                  // Fallback to placeholder if image fails to load
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="size-full flex items-center justify-center text-gray-400 text-xs">
                No Image
              </div>
            )}
          </div>

          {/* Wine info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-1">
              {wine.wine}
            </h3>
            {wine.producer && (
              <p className="text-xs text-gray-600 line-clamp-1 mb-1">
                {wine.producer}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {wine.vintage && (
                <Badge variant="outline" className="text-xs px-1 py-0">
                  <Calendar className="size-3 mr-1" />
                  {wine.vintage}
                </Badge>
              )}
              {wine.readyToDrink && (
                <Badge variant="default" className="text-xs px-1 py-0 bg-green-100 text-green-800">
                  Ready
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Wine details */}
        <div className="space-y-1 text-xs">
          {wine.varietal && (
            <div className="flex items-center gap-1 text-gray-600">
              <span className="font-medium">Varietal:</span> {wine.varietal}
            </div>
          )}
          {wine.region && (
            <div className="flex items-center gap-1 text-gray-600">
              <MapPin className="size-3" />
              {wine.region}
            </div>
          )}
          {(wine.location || wine.bin) && (
            <div className="flex items-center gap-1 text-gray-600">
              <span className="font-medium">Location:</span>
              {[wine.location, wine.bin].filter(Boolean).join(' - ')}
            </div>
          )}
        </div>

        {/* Pricing info */}
        {(wine.price || wine.valuation) && (
          <div className="bg-gray-50 rounded-md p-2 text-xs">
            <div className="flex justify-between items-center">
              {wine.price && (
                <div className="flex items-center gap-1">
                  <DollarSign className="size-3" />
                  <span>Paid: {formatPrice(wine.price)}</span>
                </div>
              )}
              {wine.valuation && (
                <div className="flex items-center gap-1">
                  <span>Value: {formatPrice(wine.valuation)}</span>
                </div>
              )}
            </div>
            {roi !== null && (
              <div className={`flex items-center gap-1 mt-1 ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <TrendingUp className="size-3" />
                <span className="font-medium">
                  {roi >= 0 ? '+' : ''}{roi.toFixed(1)}% ROI
                </span>
              </div>
            )}
          </div>
        )}

        {/* Community score */}
        {wine.communityScore && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">Community Score:</span>
            <Badge variant="secondary" className="text-xs">
              {wine.communityScore}/100
            </Badge>
          </div>
        )}

        {/* Professional reviews */}
        {wine.professionalReviews && wine.professionalReviews.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs font-medium">Reviews:</span>
            {wine.professionalReviews.slice(0, 2).map((review, index) => (
              <p key={index} className="text-xs text-gray-600 line-clamp-1">
                {review}
              </p>
            ))}
          </div>
        )}

        {/* Tasting notes summary */}
        {wine.tastingNotesSummary && (
          <div className="space-y-1">
            <span className="text-xs font-medium">Tasting Notes:</span>
            <p className="text-xs text-gray-600 line-clamp-3">
              {wine.tastingNotesSummary}
            </p>
          </div>
        )}

        {/* CellarTracker link */}
        {wine.cellarTrackerUrl && (
          <div className="pt-2 border-t">
            <a
              href={wine.cellarTrackerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="size-3" />
              View on CellarTracker
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface WineCardsGridProps {
  wines: WineCardProps['wine'][];
  contextMessage?: string;
}

export function WineCardsGrid({ wines, contextMessage }: WineCardsGridProps) {
  if (wines.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No wines to display
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {contextMessage && (
        <div className="text-sm text-gray-700 bg-blue-50 rounded-md p-3">
          {contextMessage}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wines.map((wine) => (
          <WineCard key={wine.id} wine={wine} />
        ))}
      </div>
    </div>
  );
}