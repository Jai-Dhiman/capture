import * as React from 'react';

const DropdownMenuContext = React.createContext({
  open: false,
  setOpen: (open: boolean) => {},
});

const DropdownMenu = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [open, setOpen] = React.useState(false);
  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block text-left">{children}</div>
    </DropdownMenuContext.Provider>
  );
};

const DropdownMenuTrigger = ({
  children,
  asChild = false,
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) => {
  const { open, setOpen } = React.useContext(DropdownMenuContext);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(!open);
  };

  // If asChild is true, we clone the child and add the necessary props
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleClick,
      'aria-expanded': open,
      'aria-haspopup': true,
    });
  }

  return (
    <button
      onClick={handleClick}
      aria-expanded={open}
      aria-haspopup={true}
      className="inline-flex w-full justify-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
    >
      {children}
    </button>
  );
};

const DropdownMenuContent = ({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'end';
}) => {
  const { open } = React.useContext(DropdownMenuContext);

  if (!open) return null;

  const alignmentClass = align === 'left' ? 'left-0 origin-top-left' : 'right-0 origin-top-right';

  return (
    <div
      className={`absolute z-10 mt-2 w-56 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-gray-900 dark:ring-gray-800 ${alignmentClass}`}
      role="menu"
      aria-orientation="vertical"
      tabIndex={-1}
    >
      <div className="py-1" role="none">
        {children}
      </div>
    </div>
  );
};

const DropdownMenuItem = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) => {
  const { setOpen } = React.useContext(DropdownMenuContext);

  const handleClick = () => {
    if (onClick) onClick();
    setOpen(false);
  };

  return (
    <button
      className="text-gray-700 hover:bg-gray-100 hover:text-gray-900 group flex w-full items-center px-4 py-2 text-sm dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
      role="menuitem"
      tabIndex={-1}
      onClick={handleClick}
    >
      {children}
    </button>
  );
};

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
