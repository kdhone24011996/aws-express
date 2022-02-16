

export const generateRandomDigits = (n: number) =>{
    return Math.floor(Math.random() * (9 * (Math.pow(10, n-1)))) + (Math.pow(10, n-1));
};

export const epochToDate = (epochs: number)=>{
    const d = new Date(0);
    d.setUTCSeconds(epochs);

    return d;
};


export const addHours = (hours: number , refDate?: Date) =>{
    const now = refDate ? refDate : new Date();
    let time = now.getTime();
    time += (hours * 60 * 60 * 1000);
    const dt = new Date(time);
    return dt;
};

export const extractDate = (dt: Date)=>{
    const date = dt.getDate();
    const month = dt.getMonth() + 1;
    const year = dt.getFullYear();

    const dateS  = date<10? `0${date}`: `${date}`;
    const monthS  = month<10? `0${month}`: `${month}`;

    const dateString = `${year}-${monthS}-${dateS}`;
    return dateString;

};

export const getDayStart  = (dt?: Date)=>{
    dt = dt || new Date();
    const today = new Date(dt.setUTCHours(0,0,0,0));
    return today;
};

export const getDayEnd  = (dt?: Date)=>{
    dt = dt || new Date();
    const dayEnd = new Date(dt.setUTCHours(23,59,59,999));
    return dayEnd;
};



export const isPlainObj = (o: any)=>{
    let result = o && o.constructor && o.constructor.prototype && o.constructor.prototype.hasOwnProperty("isPrototypeOf");
    result = Boolean(result);
    return result;
};

export const flattenObj = (obj: any, keys: string[]=[]): any =>{
    return Object.keys(obj).reduce((acc, key) => {
      return Object.assign(acc, isPlainObj(obj[key])
        ? flattenObj(obj[key], keys.concat(key))
        : {[keys.concat(key).join(".")]: obj[key]}
      );
    }, {});
  };


export const inject = (str: string, obj: any) => str.replace(/\${(.*?)}/g, (x,g)=> obj[g]);

export const toPlainObject = (item: any)=>JSON.parse(JSON.stringify(item));


export const extractFields = (obj: any, data: any)=>{

    if (!data){
        return obj;
    }

    if(isPlainObj(data)){
        for(const k of Object.keys(obj)){
            if (data[k]){

                const val = data[k];
                const myval = obj[k];

                if (isPlainObj(myval)){
                    const res = extractFields(myval, val);
                    obj[k] = res;
                    continue;
                }

                obj[k] = data[k];
            }
        }
        obj.id = data._id || data.id;
        obj._id = obj.id;
        return obj;
    }

    obj.id = data;
    obj._id = obj.id;
    return obj;
};