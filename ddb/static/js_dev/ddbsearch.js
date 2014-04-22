<!--
// Copyright 2014 in medias res Gesellschaft fuer Informationstechnologie mbH
// The ddb project licenses this file to you under the Apache License,
// version 2.0 (the "License"); you may not use this file except in compliance
// with the License. You may obtain a copy of the License at:
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.
-->

DDB.Search = OpenLayers.Class(OpenLayers.Control, {
    $template : $('<div id="apisearch"><form>'+
                    '<input id="apisearchinput" type="text" placeholder="Was?" /><br />'+
                    '<input id="apisearchbutton" class="button" type="submit" value="Finde POIs" />'+
                    '<p>'+
                    '<label for="apisearchfiltercheck">Filter?</label>'+
                    '<input id="apisearchfiltercheck" type="checkbox" name="filtercheckbox"/> <br />'+
                    '<label for="amount">Datum:</label>'+
                    '<input type="text" id="amount" style="border:0; color:#a5003b; font-weight:bold;" />'+
                    '</p>'+
                    '<div id="slider-range"></div>'+
                    '</form></div>'),

    initialize : function(options) {
        OpenLayers.Control.prototype.initialize.apply(this, [options]);
        $(this.div).html()
        $(this.div).append(this.$template)
        $("#slider-range").slider({
            range: true,
            min: DDB.globals['minyear'],
            max: DDB.globals['maxyear'],
            values: [DDB.globals['minyear'], DDB.globals['maxyear']],
            slide: function (event, ui) {
                $("#amount").val(ui.values[0] + " - " + ui.values[1]);
            }
        });
        $("#amount").val($("#slider-range").slider("values", 0) +
            " - " + $("#slider-range").slider("values", 1));
        var self = this;
        $("#apisearch form").submit(function(){
            self.api_search.call(self);
            return false;
        })
        var style = new OpenLayers.Style({
                    strokeColor : "#000000",
                    strokeWidth : 0,
                    strokeOpacity : 0.7,
                    fillColor : "${getColor}",
                    fillOpacity : 0.8,
                    pointRadius : "${getRadius}",
                },{
                    context : {
                        getRadius : function(feature){
                            return (7-2.3/feature.data.count) * 1.4;
                        },
                        getColor: function(feature){
                            if (feature.data.count > 1.0){
                                return "#A5003B";
                            }
                            else return "#FF0000"
                        }
                    }
                })
        this.vector = new OpenLayers.Layer.Vector("vectorlayer", {
            visibility:true,
            displayInLayerSwitcher:false,
            isBaseLayer:false,

            styleMap : new OpenLayers.StyleMap({
                //Docs: http://dev.openlayers.org/apidocs/files/OpenLayers/Symbolizer/Point-js.html
                //Andere styles sind möglich.
                'default' : style,
                'temporary' : style,
                'select' : style
            }),

            eventListeners : {
                featurehighlighted : function(evt){
                    var f = arguments[0].feature
                    var l = f.data.ids

                    var lonlat = new OpenLayers.LonLat(
                                evt.feature.geometry.x,
                                evt.feature.geometry.y
                    );

                    var html = 'POIs: <br />'

                    if (l.length == 1) {
                        html = $.ajax({
                            url: DDB.globals['get_url'] +'/'+ l[0][0],
                            data:{
                                'format':'html',
                            },
                        dataType: 'html',
                        success: function(data){
                                var popup = new OpenLayers.Popup.Anchored(
                                    'myPopup',
                                    lonlat,
                                    new OpenLayers.Size(250, 250),
                                    data,
                                    {size: {w: 14, h: 14}, offset: {x: -7, y: -7}},
                                    false
                                );

                                evt.feature.popup = popup;
                                DDB.map.addPopup(popup, true);
                        }
                        })
                    } else {
                        for (i=0;i<l.length;i++){
                            html += '<a href="'+ DDB.globals['apiitem_url'] + l[i][0] + '" target="_blank">' + l[i][1] + '</a><br />';
                        }
                        var popup = new OpenLayers.Popup.Anchored(
                            'myPopup',
                            lonlat,
                            new OpenLayers.Size(250, 250),
                            html,
                            {size: {w: 14, h: 14}, offset: {x: -7, y: -7}},
                            false
                        );

                        evt.feature.popup = popup;
                        DDB.map.addPopup(popup, true);
                    }
                },
                featureunhighlighted: function(evt) {
                    DDB.map.removePopup(evt.feature.popup);
                },
                featureselected: function(evt){
                },
                featureunselected: function(evt){
                    if(evt.feature.popup) {
                        DDB.map.removePopup(evt.feature.popup);
                    }
                }
            }
        })
        this.searchBoxVector =  new OpenLayers.Layer.Vector("searchBox",{
            visibility:true,
            displayInLayerSwitcher:false,
            isBaseLayer:false,
            styleMap : new OpenLayers.StyleMap({
                'default' : new OpenLayers.Style({
                    strokeColor : "#000000",
                    strokeWidth : 2,
                    strokeOpacity : 0.2,
                    fillColor : "#000044",
                    fillOpacity : 0.05,

                },{
                    context : {
                        getRadius : function(feature){
                            return 7-5.3/feature.data.count
                        }
                    }
                }),
            })
        })
        this.format = new OpenLayers.Format.GeoJSON({
        });


    },
    setMap : function(){
        OpenLayers.Control.prototype.setMap.apply(this, arguments);
        this.map.addLayers([this.vector])
        this.map.addLayers([this.searchBoxVector])
        this.map.events.on({
            "zoomend" : this.api_search,
            //"moveend": this.api_search,
            scope:this
        })
        hoverControl = new OpenLayers.Control.SelectFeature([this.vector], {
            hover : true,
            highlightOnly : true,
            renderIntent : "temporary",
            eventListeners : {
                beforefeaturehighlighted : function(event) {
                    if ( typeof event.feature.layer.eventListeners != "undefined" && event.feature.layer.eventListeners != null && "featurehighlighted" in event.feature.layer.eventListeners) {
                        event.feature.layer.eventListeners.featurehighlighted(event)
                    }
                },
                featureunhighlighted : function(event) {
                    if ( typeof event.feature.layer.eventListeners != "undefined" && event.feature.layer.eventListeners != null && "featureunhighlighted" in event.feature.layer.eventListeners) {
                        event.feature.layer.eventListeners.featureunhighlighted(event)
                    }
                }
            }
        });
        this.map.addControl(hoverControl);
        hoverControl.activate();
        var selectControl = new OpenLayers.Control.SelectFeature([this.vector], {
            clickout : true,
            toggle : false,
            multiple : true,
            hover : false,
            toggleKey : "ctrlKey", // ctrl key removes from selection
            multipleKey : "shiftKey" // shift key adds to selection
        });
        this.map.addControl(selectControl);
        selectControl.activate()

    },
    rc:0,
    api_search : function(e){
        var isEvent = false
        if (typeof e != "undefined") {
            isEvent=true;
        }
        var rc = this.rc+1;
        this.rc = rc;
        var self = this;
        window.setTimeout(
            function(){
                if (rc == self.rc){

                    self._api_search.call(self, rc, isEvent)
                }
            }, 50
        )
    },
    last_params : null,
    _api_search: function(rc, isEvent){

        var params = {}
        if (!isEvent) {
            params.query = $("#apisearchinput").val();
            params.filtercheckbox = $("#apisearchfiltercheck").prop('checked');
            params.filterdatum = $("#amount").val();
            var e = this.map.getExtent();
            params.bbox = e.left+","+e.bottom+","+e.right+","+e.top;
            params.format = "json"
            var searchBox = new OpenLayers.Feature.Vector(
                                OpenLayers.Geometry.fromWKT(
                                "POLYGON(("+e.left+" "+e.bottom+","+e.left+" "+e.top+","+e.right+" "+e.top+","+e.right+" "+e.bottom+","+e.left+" "+e.bottom+"))"
                            ));
            this.searchBoxVector.removeAllFeatures()
            this.searchBoxVector.addFeatures([searchBox]);
            this.last_params = params

        }
        else if (this.last_params == null){
            return;
        }
        else{
            params = this.last_params;
        }
        params.resolution = this.map.getResolution();
        var self = this;

        $.get(DDB.globals.search_url, params, function(data){
            self.api_search_callback.call(self, data, rc)
        })
    },
    api_search_callback: function(d, rc){
        if (rc == this.rc) {
            this.vector.removeAllFeatures()
            this.vector.addFeatures(this.format.read(d))
        }
    },

})