/**
 * Objective: Show a searchable, bounded picker for supplied model identifiers.
 * Used: When selecting or clearing an agent's model.
 */

import type { ExtensionContext } from '@earendil-works/pi-coding-agent';
import { fuzzyFilter, Input, SelectList, Text } from '@earendil-works/pi-tui';

type SelectModelInput = {
  ui: ExtensionContext['ui'];
  choices: string[];
};

const CLEAR_ROLE_ITEM = { value: '', label: 'None — clear this role' };

export const selectModel = ({
  ui,
  choices,
}: SelectModelInput): Promise<string | null | undefined> =>
  ui.custom<string | null | undefined>((tui, theme, keybindings, done) => {
    const input = new Input({ prompt: 'Search: ' });
    const title = new Text('Select model', 0, 0);
    const hint = new Text('Type to search. Up/down navigate, Enter select, Escape cancel.', 0, 0);

    const createList = (query: string) => {
      const items = fuzzyFilter(choices, query, (value) => value).map((value) => ({
        value,
        label: value,
      }));

      items.unshift(CLEAR_ROLE_ITEM);

      const list = new SelectList(items, 10, {
        selectedPrefix: (text) => theme.fg('accent', text),
        selectedText: (text) => theme.fg('accent', text),
        description: (text) => theme.fg('muted', text),
        scrollInfo: (text) => theme.fg('dim', text),
        noMatch: (text) => theme.fg('warning', text),
      });

      list.onSelect = (item) => done(item === CLEAR_ROLE_ITEM ? null : item.value);
      list.onCancel = () => done(undefined);

      return list;
    };

    let list = createList('');

    const component = {
      focused: false,
      capturesViewportInput: list.capturesViewportInput,
      render: (width: number) => {
        input.focused = component.focused;

        return [
          ...title.render(width),
          ...input.render(width),
          ...list.render(width),
          ...hint.render(width),
        ];
      },
      invalidate: () => {
        title.invalidate();
        input.invalidate();
        list.invalidate();
        hint.invalidate();
      },
      handleInput: (data: string) => {
        if (
          (
            [
              'tui.select.up',
              'tui.select.down',
              'tui.select.pageUp',
              'tui.select.pageDown',
              'tui.select.confirm',
              'tui.select.cancel',
            ] as const
          ).some((key) => keybindings.matches(data, key))
        ) {
          list.handleInput(data);
        } else {
          const previousQuery = input.getValue();
          input.handleInput(data);

          if (input.getValue() !== previousQuery) list = createList(input.getValue());
        }

        tui.requestRender();
      },
    };

    return component;
  });
