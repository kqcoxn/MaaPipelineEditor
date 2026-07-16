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

const IconBiaodanmoban: FunctionComponent<Props> = ({ size, color, style: _style, ...rest }) => {
  const style = _style ? { ...DEFAULT_STYLE, ..._style } : DEFAULT_STYLE;

  return (
    <svg viewBox="0 0 1024 1024" width={size + 'px'} height={size + 'px'} style={style} {...rest}>
      <path
        d="M798.72 962.56H225.28c-90.112 0-163.84-73.728-163.84-163.84V81.92c0-12.288 8.192-20.48 20.48-20.48h737.28c12.288 0 20.48 8.192 20.48 20.48v675.84h102.4c12.288 0 20.48 8.192 20.48 20.48v20.48c0 90.112-73.728 163.84-163.84 163.84zM102.4 102.4v696.32c0 67.584 55.296 122.88 122.88 122.88h573.44c67.584 0 122.88-55.296 122.88-122.88h-102.4c-12.288 0-20.48-8.192-20.48-20.48V102.4H102.4z"
        fill={getIconColor(color, 0, '#1C2754')}
      />
      <path
        d="M798.72 921.6H266.24c-90.112 0-163.84-73.728-163.84-163.84V102.4h696.32v819.2z"
        fill={getIconColor(color, 1, '#50BFFF')}
      />
      <path
        d="M798.72 921.6H225.28v-122.88h696.32c0 67.584-55.296 122.88-122.88 122.88z"
        fill={getIconColor(color, 2, '#B1E2FF')}
      />
      <path
        d="M225.28 675.84c67.584 0 122.88 55.296 122.88 122.88s-55.296 122.88-122.88 122.88-122.88-55.296-122.88-122.88 55.296-122.88 122.88-122.88z"
        fill={getIconColor(color, 3, '#50BFFF')}
      />
      <path
        d="M184.32 245.76h266.24v225.28H184.32z"
        fill={getIconColor(color, 4, '#A5DEFF')}
      />
      <path
        d="M450.56 245.76h266.24v225.28H450.56z"
        fill={getIconColor(color, 5, '#93D0FF')}
      />
      <path
        d="M184.32 471.04h266.24v225.28H184.32z"
        fill={getIconColor(color, 6, '#FFFFFF')}
      />
      <path
        d="M450.56 471.04h266.24v225.28H450.56z"
        fill={getIconColor(color, 7, '#D7E9FF')}
      />
    </svg>
  );
};

IconBiaodanmoban.defaultProps = {
  size: 18,
};

export default IconBiaodanmoban;
