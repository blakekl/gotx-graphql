import { PipeTransform } from '@nestjs/common';
import { GraphQLError } from 'graphql';

function invalid(message: string): never {
  throw new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });
}

export class PositiveIntPipe implements PipeTransform {
  transform(value: number): number {
    if (!Number.isInteger(value) || value < 1 || value > 2147483647) {
      invalid('ID must be a positive 32-bit integer.');
    }
    return value;
  }
}

const PROGRAMS = new Set(['gotm', 'retro', 'rpg', 'goty', 'gotwoty']);

export class NominationTypePipe implements PipeTransform {
  transform(value: string | null | undefined): string | null | undefined {
    // GraphQL enforces requiredness; optional null/omission means no filter.
    if (value != null && !PROGRAMS.has(value)) {
      invalid('nominationType must be gotm, retro, rpg, goty or gotwoty.');
    }
    return value;
  }
}

export class CalendarDatePipe implements PipeTransform {
  transform(value: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      invalid('creationDate must be a real YYYY-MM-DD calendar date.');
    }
    const [year, month, day] = value.split('-').map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (
      year < 1 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > days[month - 1]
    ) {
      invalid('creationDate must be a real YYYY-MM-DD calendar date.');
    }
    return value;
  }
}
