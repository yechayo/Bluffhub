import React from 'react';
import './RevolverCylinder.less';

interface RevolverCylinderProps {
  bulletsLeft: number;
  maxBullets?: number;
}

const RevolverCylinder: React.FC<RevolverCylinderProps> = ({ bulletsLeft, maxBullets = 6 }) => {
  // Create an array of chambers
  const chambers = Array.from({ length: maxBullets }).map((_, index) => {
    // Determine if this chamber has a bullet
    // Assuming bullets are fired sequentially, so if we have 4 bullets left,
    // chambers 0, 1, 2, 3 are full, 4, 5 are empty.
    // Or visually, maybe we want to show them being removed.
    const hasBullet = index < bulletsLeft;
    return { index, hasBullet };
  });

  return (
    <div className="revolver-cylinder">
      <div className="cylinder-body">
        {chambers.map((chamber) => (
          <div 
            key={chamber.index} 
            className={`chamber chamber-${chamber.index} ${chamber.hasBullet ? 'full' : 'empty'}`}
          >
            <div className="bullet-head" />
          </div>
        ))}
        <div className="center-pin" />
      </div>
    </div>
  );
};

export default RevolverCylinder;
