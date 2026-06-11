"use client";

import * as React from "react";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function flagEmoji(country: string): string {
  return String.fromCodePoint(...[...country].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

const COUNTRIES = getCountries()
  .map((code) => ({
    code,
    name: regionNames.of(code) ?? code,
    callingCode: getCountryCallingCode(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

interface PhoneInputProps {
  /** Full international value, e.g. "+96171123456". */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  placeholder?: string;
  "aria-invalid"?: boolean;
  defaultCountry?: CountryCode;
}

export function PhoneInput({
  value,
  onChange,
  onBlur,
  id,
  placeholder = "71 123 456",
  defaultCountry = "US",
  ...rest
}: PhoneInputProps) {
  const [country, setCountry] = React.useState<CountryCode>(defaultCountry);
  const [open, setOpen] = React.useState(false);

  // Derive the national part shown in the input from the full value.
  const national = React.useMemo(() => {
    if (!value) return "";
    const parsed = parsePhoneNumberFromString(value);
    if (parsed?.country && parsed.country !== country) {
      // Keep showing what was typed; the country select syncs on change below.
      return new AsYouType(parsed.country).input(parsed.nationalNumber);
    }
    const prefix = `+${getCountryCallingCode(country)}`;
    const rawNational = value.startsWith(prefix) ? value.slice(prefix.length) : value;
    return new AsYouType(country).input(rawNational);
  }, [value, country]);

  const emit = (nationalDigits: string, c: CountryCode) => {
    const digits = nationalDigits.replace(/[^\d]/g, "");
    onChange(digits ? `+${getCountryCallingCode(c)}${digits}` : "");
  };

  const handleInput = (raw: string) => {
    if (raw.trim().startsWith("+")) {
      // Full international entry — adopt it and sync the country picker.
      const parsed = parsePhoneNumberFromString(raw);
      if (parsed?.country) setCountry(parsed.country);
      onChange(raw.replace(/[^\d+]/g, ""));
      return;
    }
    emit(raw, country);
  };

  const selected = COUNTRIES.find((c) => c.code === country);

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={`Country: ${selected?.name}`}
            className="w-28 shrink-0 justify-between px-2.5"
          >
            <span className="truncate">
              {selected ? `${flagEmoji(selected.code)} +${selected.callingCode}` : "Country"}
            </span>
            <ChevronsUpDownIcon className="size-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search country…" />
            <CommandList>
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {COUNTRIES.map((c) => (
                  <CommandItem
                    key={c.code}
                    value={`${c.name} ${c.code} +${c.callingCode}`}
                    onSelect={() => {
                      setCountry(c.code);
                      setOpen(false);
                      const digits = national.replace(/[^\d]/g, "");
                      if (digits) emit(digits, c.code);
                    }}
                  >
                    <span>{flagEmoji(c.code)}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="text-muted-foreground text-xs">+{c.callingCode}</span>
                    {c.code === country && <CheckIcon className="size-4" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={placeholder}
        value={national}
        onChange={(e) => handleInput(e.target.value)}
        onBlur={onBlur}
        className={cn("flex-1")}
        {...rest}
      />
    </div>
  );
}
