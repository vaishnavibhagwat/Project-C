import type { WidgetCategory, WidgetDefinition } from '@/types';
import { validateWidgetConfig, type ConfigValidationResult } from './configValidator';
import { validateWidgetDefinition } from './definitionValidator';

/** Thrown when a widget id is registered twice. */
export class DuplicateWidgetError extends Error {
  readonly widgetId: string;

  constructor(widgetId: string) {
    super(`A widget with id "${widgetId}" is already registered.`);
    this.name = 'DuplicateWidgetError';
    this.widgetId = widgetId;
  }
}

/** Thrown when a definition breaks the WidgetDefinition contract. */
export class InvalidWidgetDefinitionError extends Error {
  readonly errors: readonly string[];

  constructor(label: string, errors: readonly string[]) {
    super(`Invalid widget definition ${label}:\n- ${errors.join('\n- ')}`);
    this.name = 'InvalidWidgetDefinitionError';
    this.errors = errors;
  }
}

function labelOf(definition: { id?: unknown }): string {
  return typeof definition.id === 'string' && definition.id !== ''
    ? `"${definition.id}"`
    : '(no id)';
}

/**
 * Widget definitions keyed by id. Registration validates the whole contract and rejects
 * duplicate ids. Iteration follows registration order.
 *
 * `T` lets the app store definitions that carry extra runtime helpers (see RegisteredWidget)
 * while tests and other callers can use plain WidgetDefinitions. Built-in widgets are
 * registered at start-up; plugins can add more at runtime. Components that list widgets
 * subscribe (useRegistryVersion) so they re-render when the set changes.
 */
export class WidgetRegistry<T extends WidgetDefinition = WidgetDefinition> {
  private readonly widgets = new Map<string, T>();
  private readonly listeners = new Set<() => void>();
  private revision = 0;

  /** Call `listener` after every registration or removal. Returns the unsubscribe function. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Increases on every change; a cheap snapshot for useSyncExternalStore. */
  getVersion = (): number => this.revision;

  private changed(): void {
    this.revision += 1;
    for (const listener of [...this.listeners]) listener();
  }

  /** Add a widget. Throws InvalidWidgetDefinitionError or DuplicateWidgetError. */
  registerWidget(definition: T): void {
    const result = validateWidgetDefinition(definition);
    if (!result.valid) throw new InvalidWidgetDefinitionError(labelOf(definition), result.errors);
    if (this.widgets.has(definition.id)) throw new DuplicateWidgetError(definition.id);
    this.widgets.set(definition.id, definition);
    this.changed();
  }

  getWidget(id: string): T | undefined {
    return this.widgets.get(id);
  }

  hasWidget(id: string): boolean {
    return this.widgets.has(id);
  }

  /** Every widget, in registration order. The array is a copy. */
  getAllWidgets(): T[] {
    return Array.from(this.widgets.values());
  }

  getWidgetsByCategory(category: WidgetCategory): T[] {
    return this.getAllWidgets().filter((w) => w.category === category);
  }

  /** Remove a widget. Returns false when the id was not registered. */
  unregisterWidget(id: string): boolean {
    const removed = this.widgets.delete(id);
    if (removed) this.changed();
    return removed;
  }

  /** Check a config against the configSchema of the widget registered under `id`. */
  validateConfig(id: string, config: unknown): ConfigValidationResult {
    const widget = this.widgets.get(id);
    if (!widget) {
      return {
        valid: false,
        errors: [{ path: '', keyword: 'widget', message: `Unknown widget "${id}".` }],
      };
    }
    return validateWidgetConfig(config, widget.configSchema);
  }

  get size(): number {
    return this.widgets.size;
  }
}
