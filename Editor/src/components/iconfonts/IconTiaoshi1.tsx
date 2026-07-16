/* tslint:disable */
/* eslint-disable */

import React, { CSSProperties, SVGAttributes, FunctionComponent } from 'react';
import { getIconColor } from './helper';

interface Props extends Omit<SVGAttributes<SVGElement>, 'color'> {
  size?: number;
  color?: string | string[];
}

const DEFAULT_STYLE: CSSProperties = {
  display: 'block',
};

const IconTiaoshi1: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M782.752 320.032l0.672 0.672a58.432 58.432 0 0 1-0.64 81.568L736 434.88V544h128c0 32.128-25.856 64-57.76 64H736v32c0 16.576-1.792 32.736-5.216 48.288a137.6 137.6 0 0 1-2.816 17.024l90.88 80.256c-22.592 22.72-64.64 16.864-87.2-5.856l-25.248-28.352a224.128 224.128 0 0 1-162.368 110.368L544 448h-64v413.76a224.128 224.128 0 0 1-162.4-110.4l-25.248 28.352c-22.56 22.72-64.64 28.576-87.168 5.856l90.88-80.256a133.312 133.312 0 0 1-2.816-17.024A223.168 223.168 0 0 1 288 640v-32.032L217.76 608c-30.4 0-55.296-28.928-57.6-59.424L160 544h128v-109.056L241.248 402.24a58.432 58.432 0 0 1-0.672-81.568l0.64-0.672L318.048 384h387.968l76.8-63.968zM512 192a160 160 0 0 1 160 160H352l0.16-6.944A160 160 0 0 1 512 192z"
        fill={getIconColor(color, 0, '#41C297')}
      />
    </svg>
  );
};

IconTiaoshi1.defaultProps = {
  size: 18,
};

export default IconTiaoshi1;
