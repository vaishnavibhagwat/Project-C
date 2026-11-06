import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders, widgetProps } from '@/__tests__/render';
import { describeWidgetStates } from '@/__tests__/widgetStates';
import { stressScenariosDefinition } from '../config';
import StressScenarios from '../index';
import { stressSummary, worstScenario } from '../model';
import { configuredConfig, emptyData, fixtureData } from './index';

const data = fixtureData();
const defaults = stressScenariosDefinition.defaultConfig;

describe('StressScenarios', () => {
  it('finds the worst scenario (the COVID replay) and summarises all four', () => {
    expect(worstScenario(data)?.id).toBe('covid-2020');
    expect(stressSummary(data)).toMatch(
      /^Estimated portfolio impact: Nifty 50 −10% .+; Rates \+100 bps .+; INR −5% vs USD .+; 2020 COVID replay .+\. Worst: 2020 COVID replay\.$/,
    );
  });

  it('lists each scenario with its impact, marks the worst, and shows details', () => {
    renderWithProviders(<StressScenarios {...widgetProps(defaults, data, 700, 300)} />);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    const covid = screen.getByRole('rowheader', { name: /2020 COVID replay/ });
    expect(within(covid).getByText('Worst')).toBeInTheDocument();
    expect(screen.getAllByText(/Largest:/).length).toBe(4);
  });

  it('hides details and shows USD when configured', () => {
    renderWithProviders(<StressScenarios {...widgetProps(configuredConfig, data, 700, 300)} />);
    expect(screen.queryByText(/Largest:/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/\$/).length).toBeGreaterThan(0);
  });
});

describeWidgetStates('stress-scenarios', { data: fixtureData, emptyData });
