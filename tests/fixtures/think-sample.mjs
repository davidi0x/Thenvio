// A Claude brainstorm answer shaped like THINK_SCHEMA, for tests.
export const SAMPLE={goal:'100 paying cafes in 6 months',
 questions:[{question:'What do cafes pay for card terminals today?',why:'Sets the price ceiling'}],
 alternatives:[
  {title:'QR sticker instead of a terminal',how:'Customers scan and pay by phone.',parent:'ROOT',impact:4,effort:2,mustBeTrue:['Customers already pay by phone in cafes'],test:'5 cafes for 2 weeks; pass if 30% of payments use QR'},
  {title:'Loyalty card that also pays',how:'Stamps and payment in one app.',parent:'ROOT',impact:3,effort:4,mustBeTrue:['Regulars want a cafe app'],test:'Waitlist at 3 cafes; pass if 50 sign-ups'},
  {title:'Sell through POS vendors',how:'Partner instead of selling cafe by cafe.',parent:'ROOT',impact:5,effort:5,mustBeTrue:[],test:''}],
 bestPath:{choice:'QR sticker instead of a terminal',why:'Lowest cost to start and fastest to test.',steps:['Recruit 5 cafes','Measure QR share'],risk:'Payment fees',planB:'Loyalty card'}};
