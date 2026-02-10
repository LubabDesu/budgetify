import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export function AnalyticsQueryBox() {
    return (
        <Card className="bg-zinc-900/40 border-zinc-800">
            <CardHeader>
                <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Ask Your Data
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-6 text-sm text-zinc-400">
                    Developing a way to chat with your data...
                </div>
            </CardContent>
        </Card>
    );
}
