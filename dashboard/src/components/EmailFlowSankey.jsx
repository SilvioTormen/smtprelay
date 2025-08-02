import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';

const EmailFlowSankey = ({ data, width = 1200, height = 600 }) => {
  const svgRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredLink, setHoveredLink] = useState(null);

  useEffect(() => {
    if (!data || !data.nodes || !data.links) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 150, bottom: 20, left: 150 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create sankey generator
    const sankeyGenerator = sankey()
      .nodeId(d => d.id)
      .nodeWidth(20)
      .nodePadding(15)
      .extent([[0, 0], [innerWidth, innerHeight]]);

    // Generate the sankey diagram
    const sankeyData = sankeyGenerator({
      nodes: data.nodes.map(d => ({ ...d })),
      links: data.links.map(d => ({ ...d }))
    });

    // Color scales
    const colorScale = d3.scaleOrdinal()
      .domain(['device', 'relay', 'exchange', 'destination'])
      .range(['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B']);

    // Add links
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('path')
      .data(sankeyData.links)
      .enter()
      .append('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', d => colorScale(d.source.type))
      .attr('stroke-width', d => Math.max(1, d.width))
      .attr('fill', 'none')
      .attr('opacity', 0.4)
      .on('mouseenter', (event, d) => {
        setHoveredLink(d);
        d3.select(event.target)
          .attr('opacity', 0.8)
          .attr('stroke-width', d => Math.max(3, d.width + 2));
      })
      .on('mouseleave', (event, d) => {
        setHoveredLink(null);
        d3.select(event.target)
          .attr('opacity', 0.4)
          .attr('stroke-width', d => Math.max(1, d.width));
      });

    // Add nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(sankeyData.nodes)
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

    // Add rectangles for nodes
    node.append('rect')
      .attr('height', d => d.y1 - d.y0)
      .attr('width', d => d.x1 - d.x0)
      .attr('fill', d => colorScale(d.type))
      .attr('stroke', '#1F2937')
      .attr('stroke-width', 1)
      .attr('rx', 3)
      .on('mouseenter', (event, d) => {
        setHoveredNode(d);
        d3.select(event.target)
          .attr('stroke-width', 3)
          .attr('stroke', '#3B82F6');
      })
      .on('mouseleave', (event, d) => {
        setHoveredNode(null);
        d3.select(event.target)
          .attr('stroke-width', 1)
          .attr('stroke', '#1F2937');
      });

    // Add labels
    node.append('text')
      .attr('x', d => (d.x0 < innerWidth / 2 ? -10 : (d.x1 - d.x0) + 10))
      .attr('y', d => (d.y1 - d.y0) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', d => d.x0 < innerWidth / 2 ? 'end' : 'start')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('fill', '#1F2937')
      .text(d => d.name);

    // Add value labels
    node.append('text')
      .attr('x', d => (d.x0 < innerWidth / 2 ? -10 : (d.x1 - d.x0) + 10))
      .attr('y', d => (d.y1 - d.y0) / 2 + 15)
      .attr('dy', '0.35em')
      .attr('text-anchor', d => d.x0 < innerWidth / 2 ? 'end' : 'start')
      .attr('font-size', '10px')
      .attr('fill', '#6B7280')
      .text(d => `${d.value.toLocaleString()} emails`);

    // Add gradient definitions
    const defs = svg.append('defs');
    
    sankeyData.links.forEach((link, i) => {
      const gradient = defs.append('linearGradient')
        .attr('id', `gradient-${i}`)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', link.source.x1)
        .attr('y1', 0)
        .attr('x2', link.target.x0)
        .attr('y2', 0);
      
      gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', colorScale(link.source.type))
        .attr('stop-opacity', 0.5);
      
      gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', colorScale(link.target.type))
        .attr('stop-opacity', 0.5);
    });

    // Update links with gradients
    link.attr('stroke', (d, i) => `url(#gradient-${i})`);

  }, [data, width, height]);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Email Flow Visualization</h3>
        <p className="text-sm text-gray-600">
          Track email flow from devices through relay to Exchange Online
        </p>
      </div>
      
      <div className="relative">
        <svg ref={svgRef} width={width} height={height} className="w-full"></svg>
        
        {/* Tooltip */}
        {(hoveredNode || hoveredLink) && (
          <div className="absolute top-2 right-2 bg-gray-900 text-white p-3 rounded-lg shadow-lg max-w-xs">
            {hoveredNode && (
              <>
                <div className="font-semibold">{hoveredNode.name}</div>
                <div className="text-sm mt-1">
                  Type: {hoveredNode.type}
                </div>
                <div className="text-sm">
                  Total: {hoveredNode.value.toLocaleString()} emails
                </div>
                {hoveredNode.metadata && (
                  <div className="text-xs mt-2 text-gray-300">
                    {Object.entries(hoveredNode.metadata).map(([key, value]) => (
                      <div key={key}>{key}: {value}</div>
                    ))}
                  </div>
                )}
              </>
            )}
            {hoveredLink && !hoveredNode && (
              <>
                <div className="font-semibold">
                  {hoveredLink.source.name} → {hoveredLink.target.name}
                </div>
                <div className="text-sm mt-1">
                  Volume: {hoveredLink.value.toLocaleString()} emails
                </div>
                <div className="text-sm">
                  {((hoveredLink.value / hoveredLink.source.value) * 100).toFixed(1)}% of source
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center space-x-6 mt-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span className="text-gray-700">Devices</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-gray-700">SMTP Relay</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-purple-500 rounded"></div>
          <span className="text-gray-700">Exchange Online</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-amber-500 rounded"></div>
          <span className="text-gray-700">Destinations</span>
        </div>
      </div>
    </div>
  );
};

export default EmailFlowSankey;