'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Zap } from 'lucide-react';
import { useI18n } from '@/components/i18n-provider';

const scenarioData = [
  { change: '-50%', score: 92, riskLevel: 'low' },
  { change: '-25%', score: 89, riskLevel: 'low' },
  { change: '0%', score: 85, riskLevel: 'low' },
  { change: '+25%', score: 68, riskLevel: 'medium' },
  { change: '+50%', score: 52, riskLevel: 'high' },
  { change: '+100%', score: 28, riskLevel: 'high' },
];

export default function RiskSimulationPage() {
  const { t } = useI18n();
  const [scenario, setScenario] = useState({
    customerName: 'Sample Customer',
    baseScore: 85,
    incomeChange: 0,
    debtChange: 0,
    interestRateChange: 0,
  });

  const [simulationResult, setSimulationResult] = useState<any>(null);

  const handleSimulate = () => {
    // Simulate a basic scoring adjustment
    let adjustedScore = scenario.baseScore;
    adjustedScore += scenario.incomeChange * 0.3;
    adjustedScore -= scenario.debtChange * 0.4;
    adjustedScore -= scenario.interestRateChange * 0.2;
    adjustedScore = Math.max(0, Math.min(100, adjustedScore));

    const riskLevel = adjustedScore >= 80 ? 'low' : adjustedScore >= 60 ? 'medium' : 'high';

    setSimulationResult({
      baseScore: scenario.baseScore,
      adjustedScore: adjustedScore.toFixed(2),
      riskLevel,
      changes: {
        income: scenario.incomeChange,
        debt: scenario.debtChange,
        interestRate: scenario.interestRateChange,
      },
    });
  };

  const getRiskBadgeVariant = (level: string): 'default' | 'destructive' | 'outline' | 'secondary' => {
    switch (level) {
      case 'low':
        return 'secondary';
      case 'medium':
        return 'default';
      case 'high':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const riskLevelLabel = (level: string) => {
    switch (level) {
      case 'low':
      case 'medium':
      case 'high':
        return t(`risk.level.${level}`);
      default:
        return level;
    }
  };

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('risk.sim.title')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('risk.sim.desc')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Simulation Form */}
        <Card>
          <CardHeader>
            <CardTitle>{t('risk.sim.card_title')}</CardTitle>
            <CardDescription>
              {t('risk.sim.card_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>{t('risk.sim.customer')}: {scenario.customerName}</Label>
              <div className="bg-secondary p-3 rounded-lg">
                <p className="text-sm font-medium">{t('risk.sim.base_score')}: {scenario.baseScore}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>
                    {t('risk.sim.income_change')}: {scenario.incomeChange > 0 ? '+' : ''}{scenario.incomeChange}%
                  </Label>
                </div>
                <Slider
                  value={[scenario.incomeChange]}
                  onValueChange={(value) => setScenario({ ...scenario, incomeChange: value[0] })}
                  min={-50}
                  max={50}
                  step={5}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>
                    {t('risk.sim.debt_change')}: {scenario.debtChange > 0 ? '+' : ''}{scenario.debtChange}%
                  </Label>
                </div>
                <Slider
                  value={[scenario.debtChange]}
                  onValueChange={(value) => setScenario({ ...scenario, debtChange: value[0] })}
                  min={-30}
                  max={50}
                  step={5}
                  className="w-full"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>
                    {t('risk.sim.rate_change')}: {scenario.interestRateChange > 0 ? '+' : ''}{scenario.interestRateChange}%
                  </Label>
                </div>
                <Slider
                  value={[scenario.interestRateChange]}
                  onValueChange={(value) => setScenario({ ...scenario, interestRateChange: value[0] })}
                  min={-5}
                  max={10}
                  step={0.5}
                  className="w-full"
                />
              </div>
            </div>

            <Button onClick={handleSimulate} className="w-full" size="lg">
              <Zap className="mr-2 h-4 w-4" />
              {t('risk.sim.run')}
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
        {simulationResult && (
          <Card>
            <CardHeader>
              <CardTitle>{t('risk.sim.result_title')}</CardTitle>
              <CardDescription>
                {t('risk.sim.result_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('risk.sim.base_score_short')}</p>
                  <p className="text-2xl font-bold mt-1">{simulationResult.baseScore}</p>
                </div>

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{t('risk.sim.adjusted_score')}</p>
                      <p className="text-3xl font-bold mt-1 text-accent">
                        {simulationResult.adjustedScore}
                      </p>
                    </div>
                    <Badge variant={getRiskBadgeVariant(simulationResult.riskLevel)} className="text-lg px-4 py-2">
                      {riskLevelLabel(simulationResult.riskLevel)}
                    </Badge>
                  </div>

                  <div className="mt-4 text-sm">
                    <p className="text-muted-foreground">
                      {t('common.change')}: {parseFloat(simulationResult.adjustedScore) - simulationResult.baseScore > 0 ? '+' : ''}
                      {(parseFloat(simulationResult.adjustedScore) - simulationResult.baseScore).toFixed(1)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-secondary p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">{t('risk.sim.breakdown')}</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• {t('risk.sim.income_change')}: {simulationResult.changes.income > 0 ? '+' : ''}{simulationResult.changes.income}%</p>
                  <p>• {t('risk.sim.debt_change')}: {simulationResult.changes.debt > 0 ? '+' : ''}{simulationResult.changes.debt}%</p>
                  <p>• {t('risk.sim.rate_change')}: {simulationResult.changes.interestRate > 0 ? '+' : ''}{simulationResult.changes.interestRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sensitivity Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t('risk.sim.sensitivity_title')}</CardTitle>
          <CardDescription>
            {t('risk.sim.sensitivity_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={scenarioData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="change" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#06b6d4"
                strokeWidth={2}
                name={t('customers.risk_score')}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
