import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Skull, 
  Cpu, 
  Lightbulb, 
  Brain, 
  Flame, 
  HeartPulse,
  Check
} from "lucide-react";
import { NICHES, type NicheId } from "@shared/schema";

const nicheIcons: Record<string, React.ReactNode> = {
  "skull": <Skull className="h-5 w-5" />,
  "cpu": <Cpu className="h-5 w-5" />,
  "lightbulb": <Lightbulb className="h-5 w-5" />,
  "brain": <Brain className="h-5 w-5" />,
  "flame": <Flame className="h-5 w-5" />,
  "heart-pulse": <HeartPulse className="h-5 w-5" />,
};

const nicheColors: Record<string, string> = {
  "red": "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  "blue": "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  "yellow": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20",
  "purple": "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  "orange": "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  "green": "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
};

const nicheSelectedColors: Record<string, string> = {
  "red": "bg-red-500 text-white border-red-600",
  "blue": "bg-blue-500 text-white border-blue-600",
  "yellow": "bg-yellow-500 text-white border-yellow-600",
  "purple": "bg-purple-500 text-white border-purple-600",
  "orange": "bg-orange-500 text-white border-orange-600",
  "green": "bg-green-500 text-white border-green-600",
};

interface NicheSelectionCardProps {
  selectedNicheId?: string;
  onSelectNiche: (nicheId: NicheId) => void;
  postsByNiche?: Record<string, number>;
}

export function NicheSelectionCard({
  selectedNicheId,
  onSelectNiche,
  postsByNiche = {},
}: NicheSelectionCardProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Content Niches</CardTitle>
        <CardDescription>
          Select a niche for content generation and scheduling
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {NICHES.map((niche) => {
            const isSelected = selectedNicheId === niche.id;
            const colorClass = isSelected 
              ? nicheSelectedColors[niche.color] 
              : nicheColors[niche.color];
            const postCount = postsByNiche[niche.id] || 0;
            
            return (
              <button
                key={niche.id}
                onClick={() => onSelectNiche(niche.id)}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover-elevate active-elevate-2 ${colorClass}`}
                data-testid={`button-niche-${niche.id}`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4" />
                  </div>
                )}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background/20">
                  {nicheIcons[niche.icon]}
                </div>
                <span className="text-sm font-medium text-center leading-tight">
                  {niche.name}
                </span>
                {postCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {postCount} posts
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
