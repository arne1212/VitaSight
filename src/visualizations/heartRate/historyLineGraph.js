import { HeartRateVisualization } from "./heartRateVisualization.js";
import { isValidColor } from "../utility.js";
import { noValidColorErrorMessage } from "../utility.js";
// import necessary d3 modules
import { 
    select as d3Select, 
    scaleTime as d3ScaleTime, 
    scaleLinear as d3ScaleLinear, 
    line as d3Line, 
    range as d3Range, 
    axisLeft as d3AxisLeft 
} from 'd3';

const d3 = {
    select: d3Select,
    scaleTime: d3ScaleTime,
    scaleLinear: d3ScaleLinear,
    line: d3Line,
    range: d3Range,
    axisLeft: d3AxisLeft
};

export class HistoryLineGraph extends HeartRateVisualization {
    constructor(containerId, options = {}) {
        super(containerId, options);
        this.numberTimestamps = options.numberTimestamps || 5;
        this.minVal;
        this.maxVal;
        this.referenceLineColor;
        this.graphLineColor;
        this.xAxisLabel;
        this.yAxisLabel;

        this.data = [];
        
        // determine size dimensions of graph
        this.margin = {
            top: this.container.clientHeight * 0.1,
            right: this.container.clientWidth * 0.1,
            bottom: this.container.clientWidth * 0.15,
            left: this.container.clientWidth * 0.15
        };
        
        this.availableWidth = this.container.clientWidth - this.margin.left - this.margin.right;
        this.availableHeight = this.availableWidth * 0.7;
        
        this.width = this.availableWidth;
        this.height = this.availableHeight;
        
        this.svgHeight = this.height + this.margin.top + this.margin.bottom;
        
        // predefine objects of the graph
        this.svg = null;
        this.xScale = null;
        this.yScale = null;
        this.xAxis = null;
        this.yAxis = null;
        this.line = null;
        this.path = null;
        this.startTime = null;
                
        this.validateAndSetOptions(options);
        this.draw();
    }

    /**
     * calculates an appropriate font size depending on the size of the graph
     * @returns a font size value
     */
    calculateFontSize() {
        const shrinkingFactor = 18;
        const baseSize = Math.min(this.width, this.height) / shrinkingFactor;
        return baseSize
    }

    /**
     * applies an appropriate global font size to the graph.
     * The larger the graph the larger the font size
     */
    applyFontStyles() {
        this.svg.selectAll("text")
            .style("font-size", `${this.calculateFontSize()}px`)
            .style("font-family", "Arial, sans-serif");
    }

    draw() {
        this.svg = d3.select(this.container)
            .append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.svgHeight)
            .append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.xScale = d3.scaleTime().range([0, this.width]);
        this.yScale = d3.scaleLinear().range([this.height, 0])
            .domain([this.minVal, this.maxVal]);

        this.svg.append("line")
            .attr("class", "x-axis-line")
            .attr("x1", 0)
            .attr("y1", this.height)
            .attr("x2", this.width)
            .attr("y2", this.height)
            .style("stroke", "black");

        this.yAxis = this.svg.append("g")
            .attr("class", "y axis");

        this.line = d3.line()
            .x(d => this.xScale(this.getRelativeTime(d.time)))
            .y(d => this.yScale(d.value));

        this.path = this.svg.append("path")
            .attr("class", "line")
            .style("fill", "none")
            .style("stroke", `${this.graphLineColor}`)
            .style("stroke-width", "2px");

        if (this.referenceVal !== undefined) {
            this.svg.append("line")
                .attr("class", "reference-line")
                .attr("x1", 0)
                .attr("y1", this.yScale(this.referenceVal))
                .attr("x2", this.width)
                .attr("y2", this.yScale(this.referenceVal))
                .style("stroke", `${this.refLineColor}`)
                .style("stroke-dasharray", "5,5");
        }

        this.xAxis = this.svg.append("g")
            .attr("class", "x axis")
            .attr("transform", `translate(0,${this.height})`);

        // calculate the position of the timestamps to spread evenly along the x-Axis
        this.xTicks = Array.from({length: this.numberTimestamps}, (_, i) => i * (this.width / (this.numberTimestamps - 1)));
        
        this.xAxis.selectAll(".tick")
            .data(this.xTicks)
            .enter()
            .append("g")
            .attr("class", "tick")
            .attr("transform", d => `translate(${d},0)`)
            .append("text")
            .attr("y", 9)
            .attr("dy", ".71em")
            .style("text-anchor", "middle");


        const yTicks = d3.range(this.minVal, this.maxVal + 1, 10);
        this.yAxis.call(d3.axisLeft(this.yScale).tickValues(yTicks));

        this.svg.append("text")
            .attr("transform", `translate(${this.width/2}, ${this.height + this.margin.bottom - 5})`)
            .style("text-anchor", "middle")
            .text(`${this.xAxisLabel}`);

        this.svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0 - this.margin.left)
            .attr("x", 0 - (this.height / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .text(`${this.yAxisLabel}`);

        this.applyFontStyles();
    }

    formatTime(date) {
        if (!this.startTime) {
            this.startTime = date;
        }
        const elapsedSeconds = Math.floor((date - this.startTime) / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    getRelativeTime(date) {
        if (!this.startTime) {
            return 0;
        }
        return (date - this.startTime) / 1000; // passed time in seconds
    }

    update(heartRate) {
        // keep data points in the boundaries of the diagram
        if (heartRate < this.minVal) {
            heartRate = this.minVal;
        }
        else if (heartRate > this.maxVal) {
            heartRate = this.maxVal;
        }

        const now = new Date();
        if (!this.startTime) {
            this.startTime = now;
        }
        this.data.push({ time: now, value: heartRate });

        const currentDuration = this.getRelativeTime(now);
        let xDomain = [0, Math.max(currentDuration, this.numberTimestamps - 1)];        
        this.xScale.domain(xDomain);

        // Aktualisiere nur die Textwerte der Zeitstempel, nicht ihre Position
        this.xAxis.selectAll(".tick text")
            .data(this.xTicks)
            .text(d => {
                const time = this.xScale.invert(d);
                return this.formatTime(new Date(this.startTime.getTime() + time * 1000));
            });

        this.path.datum(this.data)
            .attr("d", this.line);

        this.applyFontStyles();
    }

    /**
     * Method to validate the user input
     * @param {Object} options 
     */
    validateAndSetOptions(options) { 
        if (options.numberTimestamps) {
            if (Number.isInteger(options.numberTimestamps)) {
                this.numberTimestamps = options.numberTimestamps
            } else {
                this.numberTimestamps = 5;
                console.error(`Parameter numberTimestamps must be integer. Input was '${options.numberTimestamps}'. Value is set to default value 5.`)
            }
        }
        else {
            this.numberTimestamps = 5;
        }

        if (options.xAxisLabel) {
            this.xAxisLabel = options.xAxisLabel
        }
        else {
            this.xAxisLabel = "Zeit";
        }

        if (options.yAxisLabel) {
            this.yAxisLabel = options.yAxisLabel
        }
        else {
            this.yAxisLabel = "Herzfrequenz";
        }
        

        this.validateColors(options);
        this.validateMinAndMaxValue(options);
    }

    /**
     * validate the color values the user has passed
     * @param {object} options 
     */
    validateColors(options) {
        if ('referenceLineColor' in options) {
            if (isValidColor(options.referenceLineColor)) {
                this.refLineColor = options.referenceLineColor;
            } else {
                console.error(noValidColorErrorMessage(options.referenceLineColor));
            }
        } else {
            this.refLineColor = "red"; // default value
        }

        if ('graphLineColor' in options) {
            if (isValidColor(options.graphLineColor)) {
                this.graphLineColor = options.graphLineColor;
            } else {
                console.error(noValidColorErrorMessage(options.graphLineColor));
            }
        } else {
            this.graphLineColor = "steelblue"; // default value
        }
    }

    /**
     * validate that minValue <= referenceVal <= maxValue are in the right relation
     * @param {object} options 
     */
    validateMinAndMaxValue(options) {
        const defaultMinVal = 40;
        const defaultMaxVal = 180;

        if ('minValue' in options) {
            if (typeof options.minValue !== 'number' || options.minValue < 0) {
                console.error('minValue must be a number that is at least 0');
            }
            this.minVal = options.minValue 
        } else {
            this.minVal = defaultMinVal
        }

        if ('maxValue' in options) {
            if (typeof options.minValue !== 'number' || options.maxValue < 1) {
                console.error('maxValue must be a number that is at least 1');
            }
            this.maxVal = options.maxValue 
        } else {
            this.maxVal = defaultMaxVal
        }

        if (this.minVal > this.maxVal) {
            var errorMessage = `Minimum value ${this.minVal} must not be larger than maximum value ${this.maxVal}. Minimum value is set to default=${defaultMinVal} and maximum value to default=${defaultMaxVal}`;
            this.minVal = defaultMinVal;
            this.maxVal = defaultMaxVal;
            console.error(errorMessage);     
        }
        if (this.referenceVal < this.minVal  || this.referenceVal > this.maxVal) {
            var errorMessage = `Reference value ${this.referenceVal} must be between minimum value ${this.minVal} and maximum value ${this.maxVal}`;
            this.referenceVal = this.minVal + (this.maxVal - this.minVal) / 2;  // set reference value right in the middle
            console.error(errorMessage);
        }
    }
}